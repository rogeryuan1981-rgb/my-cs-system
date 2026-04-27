import React, { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Download, X, Menu, ArrowUp, ArrowDown, Eye } from 'lucide-react';

// --- 嚴格遵守模組化，純粹透過 import 引入外部依賴 ---
import useDebounce from '../hooks/useDebounce';
import Pagination from './Pagination';
import UserAvatar from './UserAvatar';
import { formatRepliesHistory, getLatestReply } from '../utils/helpers';

const PAGE_SIZE = 50;

/**
 * 紀錄資料區元件 (AllRecordsArea)
 * 供管理員檢視所有原始資料，並進行批次操作與徹底刪除
 */
const AllRecordsArea = ({
  currentUser,
  ROLES,
  tickets,
  categoryMapping,
  userMap,
  selectedTickets,
  setSelectedTickets,
  setViewModalTicket,
  handleBatchDeleteTickets,
  handleBatchHardDeleteTickets,
  handleExportExcel
}) => {
  const [allRecordsPage, setAllRecordsPage] = useState(1);
  const [allRecordsSearchTerm, setAllRecordsSearchTerm] = useState('');
  const debouncedAllRecordsSearchTerm = useDebounce(allRecordsSearchTerm, 300);
  const [sortConfig, setSortConfig] = useState({ key: 'receiveTime', direction: 'desc' });

  // 搜尋條件或排序改變時，重置回第一頁
  useEffect(() => {
    setAllRecordsPage(1);
    setSelectedTickets([]);
  }, [debouncedAllRecordsSearchTerm, sortConfig, categoryMapping, setSelectedTickets]);

  const allRecordsFiltered = useMemo(() => {
    let result = tickets.filter(t => {
      if (!debouncedAllRecordsSearchTerm) return true;
      const majorCat = categoryMapping[t.category] && categoryMapping[t.category].trim() !== '' 
        ? categoryMapping[t.category].trim() 
        : '未歸屬大類別';
        
      return (t.ticketId||'').includes(debouncedAllRecordsSearchTerm) || 
             (t.instName||'').includes(debouncedAllRecordsSearchTerm) || 
             (t.extraInfo||'').includes(debouncedAllRecordsSearchTerm) || 
             (t.category||'').includes(debouncedAllRecordsSearchTerm) || 
             majorCat.includes(debouncedAllRecordsSearchTerm) || 
             (t.receiver||'').includes(debouncedAllRecordsSearchTerm);
    });

    result.sort((a, b) => {
      let valA = sortConfig.key === 'receiveTime' ? new Date(a[sortConfig.key] || '').getTime() : (a[sortConfig.key] || '');
      let valB = sortConfig.key === 'receiveTime' ? new Date(b[sortConfig.key] || '').getTime() : (b[sortConfig.key] || '');
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [tickets, debouncedAllRecordsSearchTerm, sortConfig, categoryMapping]);

  const paginatedAllRecords = useMemo(() => {
    return allRecordsFiltered.slice((allRecordsPage - 1) * PAGE_SIZE, allRecordsPage * PAGE_SIZE);
  }, [allRecordsFiltered, allRecordsPage]);

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const renderSortHeader = (label, sortKey, align = 'left', isFirst = false, isLast = false) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className={`p-5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none ${align === 'center' ? 'text-center' : 'text-left'} ${isFirst ? 'rounded-tl-[2rem]' : ''} ${isLast ? 'rounded-tr-[2rem]' : ''}`} 
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center ${align === 'center' ? 'justify-center' : 'justify-start'} group`}>
          {label}
          <span className={`ml-1 flex flex-col ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`}>
            {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Menu size={14} />}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight shrink-0">紀錄資料區</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">顯示資料庫中所有原始紀錄（不過濾任何條件），方便檢視與批次操作。</p>
        </div>
        <div className="flex flex-col md:flex-row w-full xl:w-auto gap-3">
          {selectedTickets.length > 0 && (
            <>
              <button 
                onClick={() => handleBatchDeleteTickets(selectedTickets)} 
                className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-red-700 transition-colors font-bold text-sm shrink-0 animate-in fade-in" 
                title="標記為已刪除，保留於系統軌跡"
              >
                <Trash2 size={16} />
                <span className="hidden md:inline">邏輯刪除 ({selectedTickets.length})</span>
              </button>
              <button 
                onClick={() => handleBatchHardDeleteTickets(selectedTickets)} 
                className="flex items-center justify-center space-x-2 bg-slate-900 dark:bg-black text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-slate-700 transition-colors font-bold text-sm shrink-0 animate-in fade-in" 
                title="從資料庫徹底抹除，不留任何軌跡"
              >
                <X size={16} />
                <span className="hidden md:inline">徹底刪除 ({selectedTickets.length})</span>
              </button>
            </>
          )}
          <button 
            onClick={() => handleExportExcel(allRecordsFiltered)} 
            className="flex items-center justify-center space-x-2 bg-green-600 dark:bg-green-500 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-bold text-sm shrink-0"
          >
            <Download size={16} />
            <span className="hidden md:inline">匯出全部</span>
          </button>
          <div className="relative flex-1 xl:w-72">
            <Search size={18} className="absolute left-4 top-3 text-slate-400 dark:text-slate-500"/>
            <input 
              type="text" 
              placeholder="關鍵字搜尋... (停頓自動搜尋)" 
              value={allRecordsSearchTerm} 
              onChange={(e) => setAllRecordsSearchTerm(e.target.value)} 
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-visible flex flex-col">
        <div className="max-md:overflow-x-auto min-h-[400px] flex-1">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest sticky top-0 z-40">
              <tr>
                <th className="p-5 text-center w-12 rounded-tl-[2rem]">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    checked={paginatedAllRecords.length > 0 && selectedTickets.length === paginatedAllRecords.length} 
                    onChange={(e) => setSelectedTickets(e.target.checked ? paginatedAllRecords.map(t => t.id) : [])} 
                  />
                </th>
                <th className="p-5 text-center w-12">序號</th>
                {renderSortHeader('案件號/日期', 'receiveTime')}
                {renderSortHeader('院所', 'instName')}
                {renderSortHeader('描述/回覆摘要', 'extraInfo')}
                {renderSortHeader('建立/負責人', 'receiver')}
                {renderSortHeader('進度', 'progress', 'center', false, true)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm font-medium">
              {paginatedAllRecords.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-slate-400 dark:text-slate-500 font-bold">查無符合條件的案件</td></tr>
              ) : (
                paginatedAllRecords.map((t, index) => {
                  const fullHistoryStr = formatRepliesHistory(t.replies, t.replyContent);
                  const latestReplyStr = getLatestReply(t.replies, t.replyContent);
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => setViewModalTicket(t)} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group relative hover:z-50 ${t.isDeleted ? 'opacity-50' : ''}`}
                    >
                      <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          disabled={t.isDeleted} 
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50" 
                          checked={selectedTickets.includes(t.id)} 
                          onChange={(e) => setSelectedTickets(e.target.checked ? [...selectedTickets, t.id] : selectedTickets.filter(id => id !== t.id))} 
                        />
                      </td>
                      <td className="p-5 text-center text-slate-400 dark:text-slate-500 font-bold text-xs">{(allRecordsPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="p-5">
                        <div className={`font-black text-slate-800 dark:text-slate-200 font-mono text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center ${t.isDeleted ? 'line-through' : ''}`}>
                          {t.ticketId || '-'} <Eye size={12} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400" />
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{new Date(t.receiveTime).toLocaleDateString()} / {t.channel}</div>
                        {t.isDeleted && <span className="mt-1 inline-block bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 px-1.5 py-0.5 rounded text-[9px] font-black">已刪除</span>}
                      </td>
                      <td className="p-5"><div className={`text-slate-800 dark:text-slate-200 ${t.isDeleted ? 'line-through' : ''}`}>{t.instName}</div><div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1">{t.instCode}</div></td>
                      <td className="p-5 max-w-[250px] relative group/tooltip" style={{ overflow: 'visible' }}>
                         <div className="truncate text-slate-600 dark:text-slate-300 mb-1" title={t.extraInfo}>問: {t.extraInfo || '-'}</div>
                         <div className="truncate text-slate-400 dark:text-slate-400 text-xs cursor-help">答: {latestReplyStr || '-'}</div>
                         {fullHistoryStr && (
                           <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover/tooltip:visible group-hover/tooltip:opacity-100 z-[999] w-[350px] p-5 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-2xl shadow-2xl pointer-events-none transition-all duration-200 border border-slate-700 dark:border-slate-600 text-left">
                             <div className="absolute left-8 -top-1.5 w-3 h-3 bg-slate-800 dark:bg-slate-700 border-t border-l border-slate-700 dark:border-slate-600 transform rotate-45"></div>
                             <div className="font-bold text-blue-300 mb-2 border-b border-slate-600 dark:border-slate-500 pb-2">完整回覆紀錄</div>
                             <div className="whitespace-pre-wrap leading-relaxed text-slate-100">{fullHistoryStr}</div>
                           </div>
                         )}
                      </td>
                      <td className="p-5">
                        <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                          <UserAvatar username={t.receiver} photoURL={userMap[t.receiver]?.photoURL} className="w-5 h-5 text-[10px]" />
                          <span>{t.receiver}</span>
                        </div>
                        {t.assignee && (
                          <div className="flex items-center space-x-1.5 mt-2">
                            <UserAvatar username={t.assignee} photoURL={userMap[t.assignee]?.photoURL} className="w-4 h-4 text-[8px]" />
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/40 inline-block px-1.5 rounded">負責: {t.assignee}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase ${t.progress==='結案'?'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400':t.progress==='待處理'?'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400':'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'}`}>
                          {t.progress}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={allRecordsPage} totalCount={allRecordsFiltered.length} pageSize={PAGE_SIZE} onPageChange={setAllRecordsPage} />
      </div>
    </div>
  );
};

export default AllRecordsArea;
