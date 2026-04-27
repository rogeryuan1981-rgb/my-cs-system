import React, { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Download, Upload, FileText, Calendar, ArrowUp, ArrowDown, Menu, Eye } from 'lucide-react';

// --- 嚴格遵守模組化，純粹透過 import 引入外部依賴 ---
import useDebounce from '../hooks/useDebounce';
import Pagination from './Pagination';
import UserAvatar from './UserAvatar';
import { 
  getFirstDayOfMonth, 
  getLastDayOfMonth, 
  formatRepliesHistory, 
  getLatestReply 
} from '../utils/helpers';

const PAGE_SIZE = 50;

/**
 * 歷史查詢區元件 (HistoryArea)
 * 負責歷史案件的過濾、搜尋、排序與表格展示，並提供管理員匯入/匯出與批次刪除功能
 */
const HistoryArea = ({
  currentUser,
  ROLES,
  tickets,
  progresses,
  categoryMapping,
  userMap,
  selectedTickets,
  setSelectedTickets,
  setViewModalTicket,
  handleBatchDeleteTickets,
  handleExportExcel,
  handleImportHistoryExcel,
  isImportingHistory,
  handleDownloadTemplate
}) => {
  // --- 狀態管理 ---
  const [listPage, setListPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [sortConfig, setSortConfig] = useState({ key: 'receiveTime', direction: 'desc' });

  // 當過濾條件改變時，自動回到第一頁並清空已選取的案件
  useEffect(() => {
    setListPage(1);
    setSelectedTickets([]);
  }, [debouncedSearchTerm, historyStartDate, historyEndDate, historyProgress, sortConfig, categoryMapping, setSelectedTickets]);

  // --- 資料過濾與排序 ---
  const filteredAndSortedHistory = useMemo(() => {
    let result = tickets.filter(t => {
      if (t.isDeleted) return false;
      
      const majorCat = categoryMapping[t.category] && categoryMapping[t.category].trim() !== '' 
        ? categoryMapping[t.category].trim() 
        : '未歸屬大類別';
        
      const matchSearch = debouncedSearchTerm === '' || 
        (t.ticketId || '').includes(debouncedSearchTerm) || 
        (t.instName || '').includes(debouncedSearchTerm) || 
        (t.extraInfo || '').includes(debouncedSearchTerm) || 
        (t.category || '').includes(debouncedSearchTerm) || 
        majorCat.includes(debouncedSearchTerm) || 
        (t.receiver || '').includes(debouncedSearchTerm);
        
      const matchProgress = historyProgress === '全部' || 
        (historyProgress === '未結案' ? t.progress !== '結案' : t.progress === historyProgress);
        
      const matchDate = (historyStartDate && historyEndDate) 
        ? t.receiveTime.slice(0, 10) >= historyStartDate && t.receiveTime.slice(0, 10) <= historyEndDate 
        : true;
        
      return matchSearch && matchProgress && matchDate;
    });

    result.sort((a, b) => {
      let valA = sortConfig.key === 'receiveTime' ? new Date(a[sortConfig.key] || '').getTime() : (a[sortConfig.key] || '');
      let valB = sortConfig.key === 'receiveTime' ? new Date(b[sortConfig.key] || '').getTime() : (b[sortConfig.key] || '');
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [tickets, debouncedSearchTerm, historyStartDate, historyEndDate, historyProgress, sortConfig, categoryMapping]);

  const paginatedHistory = useMemo(() => {
    return filteredAndSortedHistory.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE);
  }, [filteredAndSortedHistory, listPage]);

  // --- 表格排序處理 ---
  const handleSort = (key) => {
    setSortConfig(prev => ({ 
      key, 
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' 
    }));
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
      
      {/* 頂部標題與操作按鈕 */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight shrink-0">歷史查詢區</h2>
        
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {currentUser?.role === ROLES.ADMIN && selectedTickets.length > 0 && (
            <button 
              onClick={() => handleBatchDeleteTickets(selectedTickets)} 
              className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-red-700 transition-colors font-bold text-sm shrink-0 animate-in fade-in"
            >
              <Trash2 size={16} />
              <span className="hidden md:inline">刪除 ({selectedTickets.length})</span>
            </button>
          )}
          
          <button 
            onClick={() => handleExportExcel(filteredAndSortedHistory)} 
            className="flex items-center justify-center space-x-2 bg-green-600 dark:bg-green-500 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-green-700 transition-colors font-bold text-sm shrink-0"
          >
            <Download size={16} />
            <span className="hidden md:inline">匯出 Excel</span>
          </button>

          {currentUser?.role === ROLES.ADMIN && (
            <>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleImportHistoryExcel} 
                  disabled={isImportingHistory} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  title="匯入歷史紀錄"
                />
                <button 
                  disabled={isImportingHistory} 
                  className="flex items-center justify-center space-x-2 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-indigo-700 transition-colors font-bold text-sm disabled:opacity-50"
                >
                  {isImportingHistory ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Upload size={16} />}
                  <span className="hidden md:inline">{isImportingHistory ? '匯入中' : '匯入歷史'}</span>
                </button>
              </div>
              <button 
                onClick={handleDownloadTemplate} 
                className="flex items-center justify-center space-x-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-2xl shadow-sm hover:bg-slate-200 transition-colors font-bold text-sm border border-slate-200 dark:border-slate-600" 
                title="下載匯入格式範本"
              >
                <FileText size={16} />
                <span className="hidden md:inline">範本下載</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 過濾與搜尋工具列 */}
      <div className="flex flex-col md:flex-row w-full gap-3">
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm shrink-0">
          <Calendar size={16} className="text-slate-400 dark:text-slate-500"/>
          <input 
            type="date" 
            value={historyStartDate} 
            onChange={e => setHistoryStartDate(e.target.value)} 
            className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer w-32 [color-scheme:light] dark:[color-scheme:dark]"
          />
          <span className="text-slate-300 dark:text-slate-600 text-xs">至</span>
          <input 
            type="date" 
            value={historyEndDate} 
            onChange={e => setHistoryEndDate(e.target.value)} 
            className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer w-32 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        
        <select 
          value={historyProgress} 
          onChange={e => setHistoryProgress(e.target.value)} 
          className="bg-white dark:bg-slate-800 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm font-bold text-sm text-slate-700 dark:text-slate-200 outline-none shrink-0"
        >
          <option value="全部">全部進度</option>
          <option value="未結案">未結案 (所有待處理)</option>
          {(Array.isArray(progresses) ? progresses : []).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-3 text-slate-400 dark:text-slate-500"/>
          <input 
            type="text" 
            placeholder="搜尋案件號、院所或內容... (停頓自動搜尋)" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>
      
      {/* 案件表格與分頁 */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-visible flex flex-col">
        <div className="max-md:overflow-x-auto min-h-[400px] flex-1">
          <table className="w-full text-left border-collapse relative">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest sticky top-0 z-40">
              <tr>
                {currentUser?.role === ROLES.ADMIN && (
                  <th className="p-5 text-center w-12 rounded-tl-[2rem]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer" 
                      checked={paginatedHistory.length > 0 && selectedTickets.length === paginatedHistory.length} 
                      onChange={(e) => setSelectedTickets(e.target.checked ? paginatedHistory.map(t => t.id) : [])} 
                    />
                  </th>
                )}
                <th className={`p-5 text-center w-12 ${currentUser?.role !== ROLES.ADMIN ? 'rounded-tl-[2rem]' : ''}`}>序號</th>
                {renderSortHeader('案件號/日期', 'receiveTime')}
                {renderSortHeader('院所', 'instName')}
                {renderSortHeader('描述/回覆摘要', 'extraInfo')}
                {renderSortHeader('建立/負責人', 'receiver')}
                {renderSortHeader('進度', 'progress', 'center', false, true)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm font-medium">
              {paginatedHistory.length === 0 ? (
                <tr><td colSpan={currentUser?.role === ROLES.ADMIN ? "7" : "6"} className="p-12 text-center text-slate-400 font-bold">查無符合條件的案件</td></tr>
              ) : (
                paginatedHistory.map((t, index) => {
                  const fullHistoryStr = formatRepliesHistory(t.replies, t.replyContent);
                  const latestReplyStr = getLatestReply(t.replies, t.replyContent);
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => setViewModalTicket(t)} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group relative hover:z-50 ${t.isDeleted ? 'opacity-50' : ''}`}
                    >
                      {currentUser?.role === ROLES.ADMIN && (
                        <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            disabled={t.isDeleted} 
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer disabled:opacity-50" 
                            checked={selectedTickets.includes(t.id)} 
                            onChange={(e) => setSelectedTickets(e.target.checked ? [...selectedTickets, t.id] : selectedTickets.filter(id => id !== t.id))} 
                          />
                        </td>
                      )}
                      <td className="p-5 text-center text-slate-400 font-bold text-xs">{(listPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="p-5">
                        <div className={`font-black text-slate-800 dark:text-slate-200 font-mono text-xs flex items-center ${t.isDeleted ? 'line-through' : ''}`}>
                          {t.ticketId || '-'} <Eye size={12} className="ml-2 opacity-0 group-hover:opacity-100 text-blue-400" />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{new Date(t.receiveTime).toLocaleDateString()} / {t.channel}</div>
                      </td>
                      <td className="p-5">
                        <div className={`text-slate-800 dark:text-slate-200 ${t.isDeleted ? 'line-through' : ''}`}>{t.instName}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{t.instCode}</div>
                      </td>
                      <td className="p-5 max-w-[250px] relative group/tooltip" style={{ overflow: 'visible' }}>
                         <div className="truncate text-slate-600 dark:text-slate-300 mb-1" title={t.extraInfo}>問: {t.extraInfo || '-'}</div>
                         <div className="truncate text-slate-400 text-xs cursor-help">答: {latestReplyStr || '-'}</div>
                         {fullHistoryStr && (
                           <div className="absolute left-0 top-full mt-2 opacity-0 invisible group-hover/tooltip:visible group-hover/tooltip:opacity-100 z-[999] w-[350px] p-5 bg-slate-800 text-white text-xs rounded-2xl shadow-2xl pointer-events-none transition-all border border-slate-700 text-left">
                             <div className="font-bold text-blue-300 mb-2 border-b border-slate-600 pb-2">完整回覆紀錄</div>
                             <div className="whitespace-pre-wrap leading-relaxed">{fullHistoryStr}</div>
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
                            <div className="text-[10px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/40 inline-block px-1.5 rounded">負責: {t.assignee}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase ${t.progress==='結案'?'bg-green-100 text-green-700':t.progress==='待處理'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'}`}>
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
        <Pagination currentPage={listPage} totalCount={filteredAndSortedHistory.length} pageSize={PAGE_SIZE} onPageChange={setListPage} />
      </div>

    </div>
  );
};

export default HistoryArea;
