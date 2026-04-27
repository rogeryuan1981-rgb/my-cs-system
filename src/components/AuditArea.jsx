import React, { useMemo } from 'react';
import { AlertCircle, FileText } from 'lucide-react';

// --- 嚴格遵守模組化，純粹透過 import 引入外部依賴 ---
import UserAvatar from './UserAvatar';

/**
 * 申請與日誌區元件 (AuditArea)
 * 供管理員簽核刪除申請，以及查閱全系統的問題描述修改紀錄
 */
const AuditArea = ({
  tickets,
  userMap,
  handleRejectDelete,
  handleApproveDelete
}) => {

  // 計算待處理的刪除申請
  const pendingDeleteRequests = useMemo(() => {
    return tickets.filter(t => !t.isDeleted && t.deleteRequest && t.deleteRequest.status === 'pending');
  }, [tickets]);

  // 計算所有的修改日誌
  const allEditLogs = useMemo(() => {
    let logs = [];
    tickets.forEach(t => {
      if (t.isDeleted) return;
      if (Array.isArray(t.editLogs) && t.editLogs.length > 0) {
        t.editLogs.forEach(log => {
          logs.push({ ...log, ticketId: t.ticketId, instName: t.instName, recordId: t.id });
        });
      }
    });
    // 依時間新到舊排序
    return logs.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [tickets]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight shrink-0">申請與日誌區</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">供管理員簽核刪除申請，以及查閱全系統的問題描述修改紀錄。</p>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* 待處理刪除申請區塊 */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col max-h-[800px]">
          <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100">
            <AlertCircle size={20} className="mr-2 text-red-600 dark:text-red-400"/> 待處理刪除申請
            {pendingDeleteRequests.length > 0 && (
              <span className="ml-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {pendingDeleteRequests.length} 件
              </span>
            )}
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {pendingDeleteRequests.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                目前無待簽核的刪除申請。
              </div>
            ) : (
              pendingDeleteRequests.map(t => (
                <div key={t.id} className="bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-5 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-black text-slate-800 dark:text-slate-200 text-sm">#{t.ticketId} - {t.instName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{t.deleteRequest.requestTime}</div>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 mb-4 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-red-600 dark:text-red-400 mr-2">申請原因:</span>
                    {t.deleteRequest.reason}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center font-bold text-slate-500 dark:text-slate-400">
                      申請人: 
                      <UserAvatar username={t.deleteRequest.requestedBy} photoURL={userMap[t.deleteRequest.requestedBy]?.photoURL} className="w-5 h-5 text-[8px] mx-1.5" /> 
                      {t.deleteRequest.requestedBy}
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => handleRejectDelete(t.id)} className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg font-bold transition-colors">
                        退回
                      </button>
                      <button onClick={() => handleApproveDelete(t.id, t.instName)} className="px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 rounded-lg font-bold shadow-sm transition-colors">
                        核准刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 原始內容修改日誌區塊 */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col max-h-[800px]">
          <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100">
            <FileText size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 原始內容修改日誌
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {allEditLogs.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                尚無任何修改紀錄。
              </div>
            ) : (
              allEditLogs.map((log, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 p-5 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-600 pb-2">
                    <div className="font-black text-indigo-800 dark:text-indigo-300 text-xs">#{log.ticketId} - {log.instName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{log.time}</div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">修改前原內容</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded line-through decoration-red-400 dark:decoration-red-500 border border-slate-200 dark:border-slate-700">
                        {log.oldContent || '(空)'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-1">修改後新內容</div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                        {log.newContent || '(空)'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    修改人: 
                    <UserAvatar username={log.user} photoURL={userMap[log.user]?.photoURL} className="w-4 h-4 text-[6px] mx-1" /> 
                    <span className="text-indigo-600 dark:text-indigo-400">{log.user}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default AuditArea;
