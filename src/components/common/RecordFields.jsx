import React from 'react';

export const InfoCard = ({ label, value, isHighlight }) => (
  <div className={`p-4 rounded-2xl border ${isHighlight ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
    <span className={`font-black text-sm ${isHighlight ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>{value || '-'}</span>
  </div>
);

export const EditField = ({ label, val, setVal, type = 'text', options = [] }) => {
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      {type === 'select' ? (
        <select value={val || ''} onChange={(event) => setVal(event.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white">
          <option value="">未指定</option>
          {safeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={val || ''} onChange={(event) => setVal(event.target.value)} rows="4" className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
      ) : (
        <input type={type} value={val || ''} onChange={(event) => setVal(event.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" />
      )}
    </div>
  );
};
