import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, X, Shield, MessageSquare, Trash2, ChevronLeft, ChevronRight, Check, Copy } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

// --- 內建輔助函式與共用元件 (為了確保單一檔案能獨立預覽不報錯，暫時將依賴元件內建。您在本地專案中若已切分，可將這些改為 import 引入) ---
const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 rounded-b-[2rem] gap-4 shrink-0">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
        顯示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, totalCount)} 筆，共 <span className="text-indigo-600 dark:text-indigo-400">{totalCount}</span> 筆
      </span>
      <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-600">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors shadow-sm disabled:shadow-none"><ChevronLeft size={18}/></button>
        <div className="px-4 text-sm font-black text-slate-700 dark:text-slate-200">{currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages}</div>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors shadow-sm disabled:shadow-none"><ChevronRight size={18}/></button>
      </div>
    </div>
  );
};

const UserAvatar = ({ username, photoURL, className = "w-8 h-8 text-xs" }) => {
  if (photoURL) return <img src={photoURL} alt={username} className={`rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-600 ${className}`} />;
  return (
    <div className={`rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0 shadow-sm border border-blue-200 dark:border-blue-800 ${className}`}>
      {username ? username.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

const CannedMessagesModal = ({ messages, onClose, showToast }) => {
  const [copyId, setCopyId] = useState(null);
  const handleCopy = (text, idx) => {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); setCopyId(idx); showToast('已複製到剪貼簿', 'success'); setTimeout(() => { setCopyId(null); onClose(); }, 500); } catch (err) { showToast('複製失敗', 'error'); }
    document.body.removeChild(ta);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0"><h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100"><MessageSquare size={20} className="mr-2 text-blue-600 dark:text-blue-400"/> 選擇罐頭回覆</h3><button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X size={20}/></button></div>
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {(Array.isArray(messages)?messages:[]).map((m, idx) => (
            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 hover:border-blue-300 dark:border-blue-500 hover:shadow-md transition-all group relative cursor-pointer" onClick={() => handleCopy(m, idx)}>
              <p className="text-sm text-slate-600 dark:text-slate-200 line-clamp-4 pr-6">{m}</p>
              <button className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400">{copyId === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}</button>
            </div>
          ))}
          {(!messages || messages.length === 0) && <p className="text-xs text-slate-400 text-center py-6">目前尚無罐頭文字。</p>}
        </div>
      </div>
    </div>
  );
};

// --- 主要模組區域 ---
const PAGE_SIZE = 50;
const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

/**
 * 紀錄維護區元件 (MaintenanceArea)
 * 供使用者查看自己負責的未結案案件，並進行後續進度更新或申請刪除
 */
const MaintenanceArea = ({ 
  currentUser, 
  tickets, 
  dbUsers, 
  userMap, 
  progresses, 
  overdueHours, 
  db, 
  showToast, 
  customPrompt, 
  cannedMessages 
}) => {
  
  const [maintainPage, setMaintainPage] = useState(1);
  const [maintainSearchTerm, setMaintainSearchTerm] = useState('');
  const debouncedMaintainSearchTerm = useDebounce(maintainSearchTerm, 300);
  const [maintainSortOrder, setMaintainSortOrder] = useState('desc');
  
  const [maintainModal, setMaintainModal] = useState(null);
  const [maintainForm, setMaintainForm] = useState({ progress: '', assignee: '', newReply: '', extraInfo: '' });
  const [showCannedModal, setShowCannedModal] = useState(false);

  // 當搜尋條件改變時，重置回第一頁
  useEffect(() => { 
    setMaintainPage(1); 
  }, [debouncedMaintainSearchTerm, maintainSortOrder]);

  // 過濾與排序維護清單
  const maintainTicketsList = useMemo(() => {
    if (!currentUser) return [];
    let result = tickets.filter(t => {
      if (t.isDeleted) return false;
      const matchSearch = debouncedMaintainSearchTerm 
        ? ((t.ticketId || '').includes(debouncedMaintainSearchTerm) || (t.instName || '').includes(debouncedMaintainSearchTerm)) 
        : true;
        
      if (currentUser.role === ROLES.ADMIN) {
        // 管理員可看到所有未結案，若有搜尋則全域搜尋
        return debouncedMaintainSearchTerm ? matchSearch : t.progress !== '結案'; 
      }
      
      // 一般使用者僅能看到自己建檔或負責的案件
      const isMine = t.receiver === currentUser.username || t.assignee === currentUser.username;
      const isUnresolved = t.progress !== '結案';
      return debouncedMaintainSearchTerm ? isMine && isUnresolved && matchSearch : isMine && isUnresolved;
    });

    result.sort((a, b) => 
      maintainSortOrder === 'asc' 
        ? new Date(a.receiveTime).getTime() - new Date(b.receiveTime).getTime() 
        : new Date(b.receiveTime).getTime() - new Date(a.receiveTime).getTime()
    );
    return result;
  }, [tickets, currentUser, debouncedMaintainSearchTerm, maintainSortOrder]);

  const paginatedMaintain = useMemo(() => {
    return maintainTicketsList.slice((maintainPage - 1) * PAGE_SIZE, maintainPage * PAGE_SIZE);
  }, [maintainTicketsList, maintainPage]);

  // 開啟維護彈窗
  const openMaintainModal = (ticket) => {
    setMaintainModal(ticket);
    setMaintainForm({ 
      progress: ticket.progress, 
      assignee: ticket.assignee || '', 
      newReply: '', 
      extraInfo: ticket.extraInfo || '' 
    });
  };

  // 申請刪除案件
  const handleRequestDelete = async () => {
    const reason = await customPrompt(`請輸入刪除案件「${maintainModal.instName || maintainModal.ticketId}」的原因：`);
    if (!reason) return;
    try {
      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const docRef = baseDbPath.length 
        ? doc(db, ...baseDbPath, 'cs_records', maintainModal.id) 
        : doc(db, 'cs_records', maintainModal.id);

      await updateDoc(docRef, { 
        deleteRequest: { 
          status: 'pending', 
          reason: reason.trim(), 
          requestedBy: currentUser.username, 
          requestTime: getFormatDate() 
        } 
      });
      showToast('刪除申請已送出，待管理員簽核。', 'success'); 
      setMaintainModal(null);
    } catch (error) { 
      showToast("申請失敗：" + error.message, "error"); 
    }
  };

  // 提交更新進度與回覆
  const handleMaintainSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) return showToast("無權限", "error");
    
    try {
      const updates = { 
        progress: maintainForm.progress, 
        assignee: maintainForm.progress !== '結案' ? maintainForm.assignee : '' 
      };
      
      if (maintainForm.progress === '結案' && maintainModal.progress !== '結案') updates.closeTime = getFormatDate();
      else if (maintainForm.progress !== '結案' && maintainModal.closeTime) updates.closeTime = '';
      
      if (maintainForm.extraInfo !== maintainModal.extraInfo) {
        updates.extraInfo = maintainForm.extraInfo;
        updates.editLogs = [
          ...(maintainModal.editLogs || []), 
          { 
            time: getFormatDate(), 
            user: currentUser.username, 
            oldContent: maintainModal.extraInfo, 
            newContent: maintainForm.extraInfo, 
            type: 'extraInfo_edit' 
          }
        ];
      }
      
      if (maintainForm.newReply.trim()) {
        const newReplyObj = { 
          time: getFormatDate(), 
          user: currentUser.username, 
          content: maintainForm.newReply.trim() 
        };
        updates.replies = [...(maintainModal.replies || []), newReplyObj];
        updates.replyContent = maintainForm.newReply.trim();
      }

      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const docRef = baseDbPath.length 
        ? doc(db, ...baseDbPath, 'cs_records', maintainModal.id) 
        : doc(db, 'cs_records', maintainModal.id);

      await updateDoc(docRef, updates);
      
      setMaintainModal(null); 
      showToast("案件更新成功", "success");
    } catch (error) { 
      showToast("更新失敗：" + error.message, "error"); 
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6 relative max-w-[1400px] mx-auto">
      {/* 頂部標題與搜尋控制區 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight mb-2">紀錄維護區</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {currentUser?.role === ROLES.ADMIN ? '管理員可查詢案件號以維護「已結案」紀錄。' : '僅顯示您負責或建檔的未結案紀錄。'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select 
            value={maintainSortOrder} 
            onChange={(e) => setMaintainSortOrder(e.target.value)} 
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">排序: 舊到新</option>
            <option value="desc">排序: 新到舊</option>
          </select>
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500"/>
            <input 
              type="text" 
              placeholder="輸入案件號碼查詢... (停頓自動搜尋)" 
              value={maintainSearchTerm} 
              onChange={(e) => setMaintainSearchTerm(e.target.value)} 
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>
      </div>
      
      {/* 案件卡片列表區 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
        {paginatedMaintain.map(t => {
          const isOverdue = t.progress !== '結案' && ((new Date().getTime() - new Date(t.receiveTime).getTime()) / 3600000) > overdueHours;
          return (
            <div 
              key={t.id} 
              onClick={() => openMaintainModal(t)} 
              className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all group flex flex-col h-full relative overflow-hidden"
            >
              <div className="absolute top-4 right-6 flex items-center space-x-2">
                {isOverdue && <span className="animate-pulse bg-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black shadow-sm">逾期</span>}
                <span className="text-[10px] font-mono text-slate-300 dark:text-slate-500">#{t.ticketId || t.id.slice(0,8)}</span>
              </div>
              <div className="flex justify-between items-start mb-4 mt-2">
                 <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${t.progress==='結案'?'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400':t.progress==='待處理'?'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400':'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'}`}>{t.progress}</span>
                 <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">{new Date(t.receiveTime).toLocaleDateString()}</span>
              </div>
              <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">{t.instName || '無特定院所'}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{t.extraInfo}</p>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs font-bold">
                <div className="flex items-center text-slate-400 dark:text-slate-500">
                  <UserAvatar username={t.receiver} photoURL={userMap[t.receiver]?.photoURL} className="w-5 h-5 text-[8px] mr-1.5" />
                  <span>建檔</span>
                </div>
                {t.assignee && (
                  <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                    <UserAvatar username={t.assignee} photoURL={userMap[t.assignee]?.photoURL} className="w-4 h-4 text-[8px]" />
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold ml-1">負責</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {maintainTicketsList.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 font-bold text-lg">目前沒有符合條件的案件 🎉</div>
        )}
      </div>
      
      <div className="mt-4">
        <Pagination currentPage={maintainPage} totalCount={maintainTicketsList.length} pageSize={PAGE_SIZE} onPageChange={setMaintainPage} />
      </div>

      {/* 維護更新面板 (Modal) */}
      {maintainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100">
                <Edit size={20} className="mr-2 text-blue-600 dark:text-blue-400"/> 案件維護 - {maintainModal.instName}
              </h3>
              <button onClick={() => setMaintainModal(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20}/></button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between mb-2">
                  <div className="text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">問題描述 (可修改)</div>
                  <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold">案件號: {maintainModal.ticketId || '舊案件'}</div>
                </div>
                <textarea 
                  value={maintainForm.extraInfo} 
                  onChange={e => setMaintainForm({...maintainForm, extraInfo: e.target.value})} 
                  rows="3" 
                  className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" 
                  placeholder="修改問題描述..."
                ></textarea>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">提示：修改此處內容將會自動產生修改日誌，供管理員查核。</p>
              </div>
              
              <div>
                <div className="text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-3">答覆軌跡紀錄</div>
                {maintainModal.replies && maintainModal.replies.length > 0 ? (
                  <div className="space-y-4">
                    {maintainModal.replies.map((r, i) => (
                      <div key={i} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-4 rounded-2xl shadow-sm flex items-start space-x-3">
                        <UserAvatar username={r.user} photoURL={userMap[r.user]?.photoURL} className="w-8 h-8 text-xs shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{r.user} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal ml-2">{new Date(r.time).toLocaleString()}</span></div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{r.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : maintainModal.replyContent ? (
                  <div className="relative flex items-start justify-end w-full pl-8 mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-5 rounded-2xl rounded-tr-sm shadow-sm w-full relative">
                      <div className="absolute top-4 -right-3.5 w-3 h-3 bg-blue-50 dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-800 rotate-45 transform border-b-transparent border-l-transparent"></div>
                      <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center"><Shield size={14} className="mr-1 text-blue-500 dark:text-blue-400"/> 歷史匯入紀錄</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{maintainModal.replyContent}</div>
                    </div>
                  </div>
                ) : <div className="text-sm text-slate-400 dark:text-slate-500 italic">尚無任何答覆紀錄</div>}
              </div>

              <form id="maintain-form" onSubmit={handleMaintainSubmit} className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2 block">更新進度</label>
                    <select 
                      value={maintainForm.progress} 
                      onChange={e=>setMaintainForm({...maintainForm, progress:e.target.value})} 
                      className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 font-bold outline-none"
                    >
                      {(Array.isArray(progresses) ? progresses : []).map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {maintainForm.progress !== '結案' ? (
                    <div>
                      <label className="text-xs font-black text-red-600 dark:text-red-400 mb-2 block">指派後續處理人</label>
                      <select 
                        value={maintainForm.assignee} 
                        onChange={e=>setMaintainForm({...maintainForm, assignee:e.target.value})} 
                        className="w-full p-3 bg-white dark:bg-slate-700 border-2 border-red-200 dark:border-red-900/50 rounded-xl font-bold text-red-700 dark:text-red-400 outline-none"
                      >
                        <option value="">-- 未指定 --</option>
                        {dbUsers.filter(u => u.role === ROLES.USER).map(u=><option key={u.id} value={u.username}>{u.username}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="opacity-50">
                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 mb-2 block">處理人</label>
                      <input disabled value={maintainForm.assignee || '自動清除指派'} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl"/>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">追加新答覆 / 註記</label>
                    <button type="button" onClick={() => setShowCannedModal(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                      <MessageSquare size={14} className="mr-1"/> 呼叫罐頭文字
                    </button>
                  </div>
                  <textarea 
                    value={maintainForm.newReply} 
                    onChange={e=>setMaintainForm({...maintainForm, newReply:e.target.value})} 
                    rows="4" 
                    className="w-full p-4 bg-blue-50/30 dark:bg-blue-900/20 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-500" 
                    placeholder="輸入新的答覆，或點擊上方按鈕複製罐頭文字貼上..."
                  ></textarea>
                </div>
              </form>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
              <button onClick={handleRequestDelete} className="px-4 py-3 text-red-500 dark:text-red-400 font-bold hover:bg-red-50 dark:bg-red-900/30 rounded-xl transition-colors text-sm flex items-center mr-auto"><Trash2 size={16} className="mr-1" /> 申請刪除</button>
              <button onClick={()=>setMaintainModal(null)} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl mr-3 transition-colors">取消</button>
              <button form="maintain-form" type="submit" disabled={currentUser?.role === ROLES.VIEWER} className={`px-8 py-3 text-white rounded-xl font-black shadow-lg transition-all ${currentUser?.role === ROLES.VIEWER ? 'bg-slate-400 dark:bg-slate-600' : 'bg-blue-600 dark:bg-blue-500 shadow-blue-200 dark:shadow-none hover:bg-blue-700 dark:hover:bg-blue-600 hover:-translate-y-0.5'}`}>
                {currentUser?.role === ROLES.VIEWER ? '無維護權限' : '確認更新並寫入軌跡'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 呼叫罐頭訊息元件 */}
      {showCannedModal && (
        <CannedMessagesModal messages={cannedMessages} onClose={() => setShowCannedModal(false)} showToast={showToast} />
      )}
    </div>
  );
};

export default MaintenanceArea;
