import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 共用分頁元件 (Pagination)
 * 用於在各個資料列表下方顯示分頁按鈕與目前筆數資訊
 */
const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  
  // 若沒有資料，則不顯示分頁元件
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 rounded-b-[2rem] gap-4 shrink-0">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
        顯示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, totalCount)} 筆，共 <span className="text-indigo-600 dark:text-indigo-400">{totalCount}</span> 筆
      </span>
      
      <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-600">
        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1} 
          className="p-2 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors shadow-sm disabled:shadow-none"
        >
          <ChevronLeft size={18}/>
        </button>
        
        <div className="px-4 text-sm font-black text-slate-700 dark:text-slate-200">
          {currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages}
        </div>
        
        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages} 
          className="p-2 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors shadow-sm disabled:shadow-none"
        >
          <ChevronRight size={18}/>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
