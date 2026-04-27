import React, { useState, useEffect } from 'react';
import { FileText, Edit, X, MessageCircle, User, Shield, CheckCircle, Save } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

// 嚴格維持外部引入，不為預覽環境妥協內建
import UserAvatar from './UserAvatar';
import { formatRepliesHistory } from '../utils/helpers';

/**
 * 輔助小元件：強制修改模式下的表單欄位
 */
const EditField = ({ label, val, setVal, type = "text", options = [] }) => (
  <div>
    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
    {type === "select" ? (
      <select value={val || ''} onChange={e => setVal(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold">
        {options.map(o => <option key={o} value={o}>{o || '未指定'}</option>)}
      </select>
    ) : type === "textarea" ? (
      <textarea value={val || ''} onChange={e => setVal(e.target.value)} rows="4" className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
    ) : (
      <input type={type} value={val || ''} onChange={e => setVal(e.target.value)} className="w-full p-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]" />
    )}
  </div>
);

/**
 * 檢視與修改案件面板 (ViewEditModal)
 * 全域彈出視窗，用於顯示案件詳細內容與對話軌跡，管理員可切換至編輯模式
 */
const ViewEditModal = ({
  ticket,
  onClose,
  currentUser,
  ROLES,
  userMap,
  channels,
  categories,
  statuses,
  progresses,
  dbUsers,
  db,
  showToast
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(ticket);

  useEffect(() => {
    setEditForm(ticket);
    setIsEditing(false);
  }, [ticket]);

  if (!ticket) return null;

  const handleModalSave = async () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try {
      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const docRef = baseDbPath.length 
        ? doc(db, ...baseDbPath, 'cs_records', editForm.id) 
        : doc(db, 'cs_records', editForm.id);

      await updateDoc(docRef, editForm);
      showToast('強制修改成功！', 'success');
      onClose();
    } catch (error) { 
      showToast('修改失敗：' + error.message, 'error'); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100">
            <FileText size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 案件紀錄檢視 - {ticket.ticketId || '舊案件'}
            {currentUser?.role === ROLES.ADMIN && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="ml-4 px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors flex items-center">
                  <Edit size={14} className="mr-1" /> 強制修改
                </button>
            )}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"><X size={20}/></button>
        </div>
        
        {/* 內容區 */}
        <div className="p-8 overflow-y-auto flex-1 space-y-8">
            {!isEditing ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1">反映管道</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200">{ticket.channel}</div></div>
                  <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1">業務類別</div><div className="text-sm font-bold text-slate-700 dark:text-slate-200">{ticket.category}</div></div>
                  <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1">建檔人</div>
                      <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
                        <UserAvatar username={ticket.receiver} photoURL={userMap[ticket.receiver]?.photoURL} className="w-5 h-5 text-[10px] mr-1.5" />
                        {ticket.receiver}
                      </div>
                  </div>
                  <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1">當前進度</div>
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase mt-1 inline-block ${ticket.progress==='結案'?'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400':ticket.progress==='待處理'?'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400':'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'}`}>
                      {ticket.progress}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">醫療院所</div><div className="text-sm font-bold text-slate-800 dark:text-slate-200">{ticket.instName} <span className="text-slate-400 dark:text-slate-500 font-mono ml-2">({ticket.instCode})</span></div></div>
                  <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">提問人資訊</div><div className="text-sm font-bold text-slate-800 dark:text-slate-200">{ticket.questioner || '未提供'}</div></div>
                </div>

                <div>
                  <h4 className="font-black text-sm text-slate-800 dark:text-slate-200 mb-4 flex items-center border-b border-slate-100 dark:border-slate-700 pb-2"><MessageCircle size={16} className="mr-2 text-blue-500 dark:text-blue-400"/> 對話軌跡與處理紀錄</h4>
                  
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                    <div className="relative flex items-start justify-start md:w-1/2 pr-8 mb-6">
                      <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-5 rounded-2xl rounded-tl-sm shadow-sm w-full relative">
                        <div className="absolute top-4 -left-3.5 w-3 h-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rotate-45 transform border-t-transparent border-r-transparent"></div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center"><User size={14} className="mr-1 text-slate-400 dark:text-slate-500"/> 客戶問題 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal ml-2">{new Date(ticket.receiveTime).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{ticket.extraInfo || '(未填寫)'}</div>
                      </div>
                    </div>

                    {ticket.replies && ticket.replies.length > 0 ? (
                      ticket.replies.map((r, i) => (
                        <div key={i} className="relative flex items-start justify-end md:w-1/2 md:ml-auto pl-8 mb-6">
                          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-5 rounded-2xl rounded-tr-sm shadow-sm w-full relative">
                            <div className="absolute top-4 -right-3.5 w-3 h-3 bg-blue-50 dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-800 rotate-45 transform border-b-transparent border-l-transparent"></div>
                            <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
                              <UserAvatar username={r.user} photoURL={userMap[r.user]?.photoURL} className="w-5 h-5 text-[8px] mr-1.5" />
                              客服：{r.user} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal ml-2">{new Date(r.time).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{r.content}</div>
                          </div>
                        </div>
                      ))
                    ) : ticket.replyContent ? (
                      <div className="relative flex items-start justify-end md:w-1/2 md:ml-auto pl-8 mb-6">
                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-5 rounded-2xl rounded-tr-sm shadow-sm w-full relative">
                          <div className="absolute top-4 -right-3.5 w-3 h-3 bg-blue-50 dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-800 rotate-45 transform border-b-transparent border-l-transparent"></div>
                          <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center"><Shield size={14} className="mr-1 text-blue-500 dark:text-blue-400"/> 歷史匯入紀錄</div>
                          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{ticket.replyContent}</div>
                        </div>
                      </div>
                    ) : <div className="text-sm text-slate-400 dark:text-slate-500 italic text-center w-full my-4">尚無任何答覆紀錄</div>}

                    {ticket.progress === '結案' && ticket.closeTime && (
                      <div className="relative flex items-center justify-center pt-4">
                        <div className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-black px-4 py-2 rounded-full border border-green-200 dark:border-green-800 shadow-sm flex items-center"><CheckCircle size={14} className="mr-2"/> 案件已於 {new Date(ticket.closeTime).toLocaleString()} 結案</div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <EditField label="反映管道" type="select" val={editForm.channel} setVal={(v) => setEditForm({...editForm, channel: v})} options={channels} />
                  <EditField label="業務類別" type="select" val={editForm.category} setVal={(v) => setEditForm({...editForm, category: v})} options={categories} />
                  <EditField label="案件狀態" type="select" val={editForm.status} setVal={(v) => setEditForm({...editForm, status: v})} options={statuses} />
                  <EditField label="當前進度" type="select" val={editForm.progress} setVal={(v) => setEditForm({...editForm, progress: v})} options={progresses} />
                  <EditField label="建檔人" val={editForm.receiver} setVal={(v) => setEditForm({...editForm, receiver: v})} />
                  <EditField label="負責人" type="select" val={editForm.assignee} setVal={(v) => setEditForm({...editForm, assignee: v})} options={['', ...dbUsers.filter(u => u.role === ROLES.USER).map(u => u.username)]} />
                  <EditField label="接收時間" type="datetime-local" val={editForm.receiveTime} setVal={(v) => setEditForm({...editForm, receiveTime: v})} />
                  <EditField label="結案時間" type="datetime-local" val={editForm.closeTime} setVal={(v) => setEditForm({...editForm, closeTime: v})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 mt-4">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">醫療院所名稱 / 代碼</div>
                    <div className="flex space-x-2">
                      <input type="text" value={editForm.instName || ''} onChange={e=>setEditForm({...editForm, instName: e.target.value})} className="w-2/3 p-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="名稱"/>
                      <input type="text" value={editForm.instCode || ''} onChange={e=>setEditForm({...editForm, instCode: e.target.value})} className="w-1/3 p-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="代碼"/>
                    </div>
                  </div>
                  <EditField label="提問人資訊" val={editForm.questioner} setVal={(v) => setEditForm({...editForm, questioner: v})} />
                </div>
                <div className="mt-4"><EditField label="詳細問題描述 (首筆)" type="textarea" val={editForm.extraInfo} setVal={(v) => setEditForm({...editForm, extraInfo: v})} /></div>
                <div className="mt-4"><EditField label="初步回覆內容 (首筆)" type="textarea" val={editForm.replyContent} setVal={(v) => setEditForm({...editForm, replyContent: v})} /></div>
              </div>
            )}
        </div>
        
        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl mr-3 transition-colors">取消修改</button>
              <button onClick={handleModalSave} className="px-8 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 dark:shadow-none flex items-center"><Save size={16} className="mr-2"/>儲存修改</button>
            </>
          ) : (
            <button onClick={onClose} className="px-8 py-3 bg-slate-800 dark:bg-slate-600 text-white font-black rounded-xl hover:bg-slate-900 dark:hover:bg-slate-500 transition-colors shadow-lg shadow-slate-200 dark:shadow-none">關閉檢視</button>
          )}
        </div>

      </div>
    </div>
  );
};

export default ViewEditModal;
