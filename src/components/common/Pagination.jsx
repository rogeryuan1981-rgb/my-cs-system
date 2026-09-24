import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ currentPage, totalCount, pageSize, onPageChange }) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-8 py-5 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 rounded-b-[2.5rem] gap-4">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
        共 <span className="text-blue-600 dark:text-blue-400 font-black">{totalCount}</span> 筆案件
      </span>
      <div className="flex items-center space-x-2">
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-xl disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-500 dark:text-slate-400">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-black px-4 dark:text-white">{currentPage} / {totalPages}</span>
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-xl disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-500 dark:text-slate-400">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
