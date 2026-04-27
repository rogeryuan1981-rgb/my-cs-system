import React, { useState, useEffect } from 'react';
import { Clock, Save, FileText, User, UserPlus, MessageSquare } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';

// 為了確保單一檔案模組的獨立運行（避免預覽環境報錯），將輔助函式直接內建於此
const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};

const getInitialForm = (username = '', channelsArr = [], progressesArr = []) => ({
  receiveTime: getFormatDate(), callEndTime: '', channel: Array.isArray(channelsArr) && channelsArr.length > 0 ? channelsArr[0] : '',
  receiver: username, instCode: '', instName: '', instLevel: '', category: '', status: '', extraInfo: '', questioner: '', replyContent: '', closeTime: '',
  progress: Array.isArray(progressesArr) && progressesArr.length > 0 ? progressesArr[0] : '待處理', assignee: '', replies: [], editLogs: []
});

/**
 * 新增紀錄區元件 (TicketForm)
 * 提供客服人員建立新案件的表單
 */
const TicketForm = ({ 
  currentUser, 
  channels, 
  categories, 
  statuses, 
  progresses, 
  dbUsers, 
  db, 
  setShowCannedModal, 
  showToast, 
  instMap,
  tickets // 需要用來計算今日的流水號
}) => {
  
  const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };
  const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' });
  const [formData, setFormData] = useState(getInitialForm(currentUser?.username, channels, progresses));
  const [isLookingUp, setIsLookingUp] = useState(false);

  // 當下拉選單資料載入後，確保有預設值
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      channel: prev.channel || (Array.isArray(channels) && channels.length > 0 ? channels[0] : ''),
      progress: prev.progress || (Array.isArray(progresses) && progresses.length > 0 ? progresses[0] : '')
    }));
  }, [channels, progresses]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    
    // 結案時間自動處理邏輯
    if (name === 'progress' && value === '結案' && !formData.closeTime) {
      newFormData.closeTime = getFormatDate();
    }
    if (name === 'progress' && value !== '結案' && formData.closeTime) {
      newFormData.closeTime = '';
    }
    if (name === 'progress' && value === '結案') {
      newFormData.assignee = ''; // 結案時清除指派人
    }
    
    setFormData(newFormData);
  };

  const handleInstCodeBlur = () => {
    if (!formData.instCode) return;
    const rawCode = formData.instCode.trim();
    
    if (rawCode === '999') {
      setFormData(prev => ({ 
        ...prev, 
        instCode: '999', 
        instLevel: '', 
        instName: prev.instName.includes('查無資料') ? '' : prev.instName 
      }));
      return;
    }
    
    setIsLookingUp(true);
    setTimeout(() => {
      const paddedCode = rawCode.padStart(10, '0');
      let data = instMap[rawCode] || instMap[paddedCode];
      if (data) {
        setFormData(prev => ({ ...prev, instCode: rawCode.length < 10 ? paddedCode : rawCode, instName: data.name, instLevel: data.level }));
      } else {
        setFormData(prev => ({ ...prev, instName: '查無資料，請確認代碼或手動新增', instLevel: '' }));
      }
      setIsLookingUp(false);
    }, 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) { 
      showToast('儲存失敗：您沒有新增權限', 'error'); 
      return; 
    }
    
    const code = formData.instCode ? formData.instCode.trim() : '';
    if (!code || (code !== '999' && !/^\d{10}$/.test(code))) {
      showToast('儲存失敗：院所代碼必須為 10 碼數字或 999', 'error');
      return;
    }
    if (!formData.channel || !formData.category || !formData.status || !formData.progress) {
      showToast('請確實選擇下拉選單選項', 'error');
      return;
    }
    if (!formData.extraInfo?.trim() || !formData.replyContent?.trim()) {
      showToast('問題描述與答覆不能為空', 'error');
      return;
    }

    try {
      setSubmitStatus({ type: 'loading', msg: '儲存中...' });
      
      // 計算流水號
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const todayTickets = tickets.filter(t => t.ticketId && t.ticketId.startsWith(todayStr));
      let maxSeq = 0;
      todayTickets.forEach(t => { 
        const seq = parseInt(t.ticketId.slice(8), 10); 
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq; 
      });
      const newTicketId = todayStr + String(maxSeq + 1).padStart(5, '0');

      const initialReplies = formData.replyContent ? [{ time: getFormatDate(), user: currentUser.username, content: formData.replyContent }] : [];
      const submissionData = { 
        ...formData, 
        ticketId: newTicketId, 
        replies: initialReplies, 
        editLogs: [], 
        createdAt: new Date().toISOString(), 
        isDeleted: false 
      };
      
      // 相容本地與預覽環境的路徑
      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const colRef = baseDbPath.length 
        ? collection(db, ...baseDbPath, 'cs_records') 
        : collection(db, 'cs_records');

      await addDoc(colRef, submissionData);
      
      showToast(`案件 ${newTicketId} 建立成功！`, 'success');
      setSubmitStatus({ type: 'success', msg: `案件 ${newTicketId} 建立成功！` });
      
      // 重置表單
      setFormData(prev => ({
        ...getInitialForm(currentUser.username, channels, progresses),
        channel: (Array.isArray(channels) && channels.includes(prev.channel)) ? prev.channel : (channels[0] || ''),
        category: '', status: '',
        progress: (Array.isArray(progresses) && progresses.includes(prev.progress)) ? prev.progress : (progresses[0] || '待處理')
      }));

      setTimeout(() => setSubmitStatus({ type: '', msg: '' }), 4000);
    } catch (error) { 
      setSubmitStatus({ type: 'error', msg: '儲存失敗。' }); 
      showToast(`儲存發生錯誤：${error.message}`, 'error');
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">新增紀錄區</h2>
          <p className="text-sm text-slate-400 dark:text-slate-400 mt-2">
            以 <span className="font-bold text-blue-600 dark:text-blue-400">{currentUser?.username}</span> 身份登錄。
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* 基本與院所資訊 */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <h3 className="font-black mb-6 flex items-center text-blue-600 dark:text-blue-400 tracking-wide uppercase text-sm">
            <User size={18} className="mr-2"/> 基本與院所資訊
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block">接收時間 <span className="text-red-500 dark:text-red-400">*</span></label>
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, receiveTime: getFormatDate() }))} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                  <Clock size={12} className="mr-1"/> 設為現在
                </button>
              </div>
              <input type="datetime-local" name="receiveTime" required value={formData.receiveTime} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"/>
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">反映管道 <span className="text-red-500 dark:text-red-400">*</span></label>
              <select name="channel" required value={formData.channel} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="" disabled>請選擇...</option>
                {(Array.isArray(channels) ? channels : []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">提問人資訊</label>
              <input type="text" name="questioner" value={formData.questioner} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="姓名 / 電話 / LINE"/>
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">院所代碼 (自動比對) <span className="text-red-500 dark:text-red-400">*</span></label>
              <input type="text" name="instCode" required pattern="^(\d{10}|999)$" title="請輸入 10 碼數字，或填寫 999" value={formData.instCode} onChange={handleFormChange} onBlur={handleInstCodeBlur} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-mono focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="輸入10碼後點擊空白處"/>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">院所名稱與層級</label>
              <div className="flex space-x-4">
                <input type="text" name="instName" value={formData.instName} onChange={handleFormChange} readOnly={formData.instCode !== '999'} className={`w-2/3 p-3.5 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ${formData.instCode === '999' ? 'bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500' : 'bg-slate-50 dark:bg-slate-700/50 font-bold'}`} placeholder={formData.instCode === '999' ? "請自行輸入單位名稱" : "名稱"}/>
                <input type="text" name="instLevel" value={formData.instLevel} readOnly className="w-1/3 p-3.5 border border-slate-200 dark:border-slate-600 rounded-2xl bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="層級"/>
              </div>
            </div>
          </div>
        </div>

        {/* 案件內容與指派 */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <h3 className="font-black mb-6 flex items-center text-blue-600 dark:text-blue-400 tracking-wide uppercase text-sm">
            <FileText size={18} className="mr-2"/> 案件內容與指派
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div>
              <label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">類別 <span className="text-red-500 dark:text-red-400">*</span></label>
              <select name="category" required value={formData.category} onChange={handleFormChange} className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="" disabled>請選擇...</option>
                {(Array.isArray(categories) ? categories : []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">狀態 <span className="text-red-500 dark:text-red-400">*</span></label>
              <select name="status" required value={formData.status} onChange={handleFormChange} className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="" disabled>請選擇...</option>
                {(Array.isArray(statuses) ? statuses : []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">進度 <span className="text-red-500 dark:text-red-400">*</span></label>
              <select name="progress" required value={formData.progress} onChange={handleFormChange} className={`w-full p-3 border border-slate-200 dark:border-slate-600 rounded-2xl font-black outline-none focus:ring-2 ${formData.progress === '結案' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 focus:ring-green-500' : formData.progress === '待處理' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 focus:ring-red-500' : formData.progress === '' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 focus:ring-orange-500'}`}>
                <option value="" disabled>請選擇...</option>
                {(Array.isArray(progresses) ? progresses : []).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            
            {formData.progress !== '結案' && (
              <div className="animate-in zoom-in-95 duration-200">
                <label className="text-xs font-bold mb-2 block text-red-600 dark:text-red-400 flex items-center">
                  <UserPlus size={14} className="mr-1"/> 指定處理人
                </label>
                <select name="assignee" value={formData.assignee} onChange={handleFormChange} className="w-full p-3 border-2 border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-700 font-bold text-red-700 dark:text-red-400 rounded-2xl outline-none focus:border-red-500">
                  <option value="">-- 未指定 --</option>
                  {(Array.isArray(dbUsers) ? dbUsers : []).filter(u => u.role === ROLES.USER).map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">詳細問題描述 <span className="text-red-500 dark:text-red-400">*</span></label>
              <textarea name="extraInfo" required minLength="2" value={formData.extraInfo} onChange={handleFormChange} rows="4" className="w-full p-5 border border-slate-200 dark:border-slate-600 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" placeholder="請詳細描述客戶的問題..."></textarea>
            </div>
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-xs font-bold block text-slate-700 dark:text-slate-300">給予的初步答覆 <span className="text-red-500 dark:text-red-400">*</span></label>
                <button type="button" onClick={() => setShowCannedModal(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                  <MessageSquare size={14} className="mr-1"/> 呼叫罐頭文字
                </button>
              </div>
              <textarea id="replyContent" name="replyContent" required minLength="2" value={formData.replyContent} onChange={handleFormChange} rows="4" className="w-full p-5 border border-slate-200 dark:border-slate-600 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30 dark:bg-blue-900/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" placeholder="給予的初步答覆..."></textarea>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-12">
          <button type="submit" disabled={submitStatus.type === 'loading' || currentUser?.role === ROLES.VIEWER} className={`px-14 py-4 text-white rounded-[1.5rem] font-black flex items-center shadow-2xl transition-all ${currentUser?.role === ROLES.VIEWER ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed' : 'bg-blue-600 dark:bg-blue-500 shadow-blue-200 dark:shadow-none hover:bg-blue-700 dark:hover:bg-blue-600 hover:-translate-y-1 active:scale-95'}`}>
            {submitStatus.type === 'loading' ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div> : <Save size={22} className="mr-3"/>} 
            {currentUser?.role === ROLES.VIEWER ? '權限不足' : '儲存案件'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketForm;
