import React, { useState, useMemo } from 'react';
import { ChevronRight, Calendar } from 'lucide-react';
import LineChart from './LineChart';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/helpers';

/**
 * 進階統計區元件 (DashboardArea)
 * 負責數據運算、顯示各類長條圖與趨勢折線圖
 */
const DashboardArea = ({
  tickets,
  categories,
  categoryMapping,
  userMap,
  ROLES,
  isDarkMode,
  setHistoryStartDate,
  setHistoryEndDate,
  setHistoryProgress,
  setSearchTerm,
  setActiveTab
}) => {
  // --- 統計圖表專用的過濾狀態 ---
  const [dashStartDate, setDashStartDate] = useState(getFirstDayOfMonth());
  const [dashEndDate, setDashEndDate] = useState(getLastDayOfMonth());
  
  const [personnelStartDate, setPersonnelStartDate] = useState(getFirstDayOfMonth());
  const [personnelEndDate, setPersonnelEndDate] = useState(getLastDayOfMonth());
  
  const [trendCategory, setTrendCategory] = useState('全類別');
  const [categoryViewMode, setCategoryViewMode] = useState('detail');
  const [personnelViewMode, setPersonnelViewMode] = useState('assignee');

  // 點擊長條圖跳轉至歷史查詢區的處理邏輯
  const handleCategoryClick = (cat) => { 
    setHistoryStartDate(dashStartDate); 
    setHistoryEndDate(dashEndDate); 
    setSearchTerm(cat); 
    setActiveTab('list'); 
  };

  // --- 數據運算核心邏輯 ---
  const dashboardStats = useMemo(() => {
    const total = tickets.filter(t => !t.isDeleted).length;
    const pending = tickets.filter(t => !t.isDeleted && t.progress !== '結案').length;
    const resolved = tickets.filter(t => !t.isDeleted && t.progress === '結案').length;
    const completionRate = total ? Math.round((resolved/total)*100) : 0;
    
    // 依日期過濾區間
    const startDateObj = new Date(`${dashStartDate}T00:00:00`);
    const endDateObj = new Date(`${dashEndDate}T23:59:59.999`);
    const rangeTickets = tickets.filter(t => !t.isDeleted && new Date(t.receiveTime) >= startDateObj && new Date(t.receiveTime) <= endDateObj);

    const personnelStartObj = new Date(`${personnelStartDate}T00:00:00`);
    const personnelEndObj = new Date(`${personnelEndDate}T23:59:59.999`);
    const personnelRangeTickets = tickets.filter(t => !t.isDeleted && new Date(t.receiveTime) >= personnelStartObj && new Date(t.receiveTime) <= personnelEndObj);

    const categoryData = {}; 
    const aggregatedCategoryData = {};
    const safeCategories = Array.isArray(categories) ? categories : [];
    safeCategories.forEach(c => categoryData[c] = 0);
    
    const assigneeData = {};
    const regionData = {};

    // 類別統計計算
    rangeTickets.forEach(t => {
      if (safeCategories.includes(t.category)) categoryData[t.category] = (categoryData[t.category] || 0) + 1;
      else categoryData['已停用類別'] = (categoryData['已停用類別'] || 0) + 1;
    });

    // 處理人員與群組統計計算
    personnelRangeTickets.forEach(t => {
      const effectiveAssignee = t.assignee || t.receiver;
      const role = userMap[effectiveAssignee]?.role;
      if (role === ROLES.USER) {
        assigneeData[effectiveAssignee] = (assigneeData[effectiveAssignee] || 0) + 1;
        const userRegion = userMap[effectiveAssignee]?.region || '未設定群組';
        regionData[userRegion] = (regionData[userRegion] || 0) + 1;
      }
    });

    // 大類別彙整計算
    Object.keys(categoryData).forEach(cat => {
      if(categoryData[cat] > 0 || Object.keys(categoryMapping).length > 0) { 
        const majorCat = categoryMapping[cat] && categoryMapping[cat].trim() !== '' ? categoryMapping[cat].trim() : '未歸屬大類別';
        aggregatedCategoryData[majorCat] = (aggregatedCategoryData[majorCat] || 0) + categoryData[cat];
      }
    });

    // 趨勢圖 (近半年) 數據產生
    const monthLabels = [];
    for(let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }

    const trendData = { total: [], phone: [], line: [], phoneToLine: [] };
    monthLabels.forEach(monthStr => {
      const monthTickets = tickets.filter(t => !t.isDeleted && t.receiveTime.substring(0, 7) === monthStr && (trendCategory === '全類別' || t.category === trendCategory));
      trendData.total.push(monthTickets.length);
      trendData.phone.push(monthTickets.filter(t => t.channel === '電話').length);
      trendData.line.push(monthTickets.filter(t => t.channel === 'LINE').length);
      trendData.phoneToLine.push(monthTickets.filter(t => t.channel === '電話轉LINE').length);
    });

    return { 
      total, pending, resolved, completionRate, 
      categoryData, aggregatedCategoryData, trendData, monthLabels, assigneeData, regionData 
    };
  }, [tickets, dashStartDate, dashEndDate, personnelStartDate, personnelEndDate, trendCategory, categories, categoryMapping, userMap, ROLES]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
      <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">進階統計區</h2>
      
      {/* 頂部數據摘要卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-black text-left mb-6">總件數</div>
          <div className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 leading-none text-right">{dashboardStats.total}</div>
        </div>
        
        <div 
          onClick={() => { 
            setHistoryStartDate(''); 
            setHistoryEndDate(''); 
            setHistoryProgress('未結案'); 
            setSearchTerm(''); 
            setActiveTab('list'); 
          }} 
          className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between cursor-pointer hover:border-red-300 dark:hover:border-red-500 hover:shadow-md transition-all group" 
          title="點擊檢視所有待處理案件"
        >
          <div className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-black text-left mb-6 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors flex justify-between items-center">
            待處理件數
            <ChevronRight className="opacity-0 group-hover:opacity-100 text-red-500 dark:text-red-400 transition-opacity" size={24} />
          </div>
          <div className="text-5xl md:text-6xl font-black text-red-500 dark:text-red-400 leading-none text-right group-hover:scale-105 transform origin-right transition-transform">
            {dashboardStats.pending}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-black text-left mb-6">完成率</div>
          <div className="text-5xl md:text-6xl font-black text-blue-600 dark:text-blue-400 leading-none text-right">{dashboardStats.completionRate}%</div>
        </div>
      </div>

      {/* 圖表區 1: 垂直長條圖 (自訂區間) */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center space-x-4">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">服務類別分佈</h3>
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                <button onClick={() => setCategoryViewMode('detail')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${categoryViewMode === 'detail' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>細項類別</button>
                <button onClick={() => setCategoryViewMode('major')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${categoryViewMode === 'major' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>大類別彙整</button>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">點擊長條圖可直接跳轉至歷史查詢區檢視該分類資料</p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-600">
            <Calendar size={16} className="text-slate-400 dark:text-slate-400 ml-2"/>
            <input type="date" value={dashStartDate} onChange={e=>setDashStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"/>
            <span className="text-slate-300 dark:text-slate-500">~</span>
            <input type="date" value={dashEndDate} onChange={e=>setDashEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer mr-2 [color-scheme:light] dark:[color-scheme:dark]"/>
          </div>
        </div>
        
        {categoryViewMode === 'major' && Object.keys(dashboardStats.aggregatedCategoryData).length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-700/30 rounded-2xl mt-4">目前無大類別資料，請至「系統設定區」進行歸屬設定。</div>
        ) : (
          <div className="flex h-[320px] items-end space-x-4 md:space-x-8 overflow-x-auto pb-4 pt-12 px-4">
            {Object.entries(categoryViewMode === 'detail' ? dashboardStats.categoryData : dashboardStats.aggregatedCategoryData).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => {
                const currentData = categoryViewMode === 'detail' ? dashboardStats.categoryData : dashboardStats.aggregatedCategoryData;
                const maxVal = Math.max(...Object.values(currentData), 1);
                const heightPct = (count / maxVal) * 100;
                const barColorClass = categoryViewMode === 'detail' ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-blue-500 dark:bg-blue-400';
                const textColorClass = categoryViewMode === 'detail' ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'group-hover:text-blue-600 dark:group-hover:text-blue-400';
                return (
                  <div key={cat} onClick={() => handleCategoryClick(cat)} title="點擊查看此分類歷史紀錄" className="group flex flex-col items-center justify-end h-full w-12 shrink-0 relative animate-in fade-in duration-500 cursor-pointer">
                    <div className="absolute -top-8 text-slate-900 dark:text-slate-800 bg-slate-100 dark:bg-slate-200 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap z-10 shadow-sm transition-transform transform group-hover:-translate-y-1">{count} 件</div>
                    <div className="w-10 bg-slate-100 dark:bg-slate-700 rounded-t-full h-full flex flex-col justify-end overflow-hidden relative group-hover:shadow-inner">
                      <div className={`w-full ${barColorClass} rounded-t-full transition-all duration-1000 ease-out group-hover:brightness-110`} style={{ height: `${heightPct}%` }}></div>
                    </div>
                    <div className={`text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-4 h-32 text-center leading-tight [writing-mode:vertical-rl] transition-colors tracking-widest select-none ${textColorClass}`}>{cat}</div>
                  </div>
                );
            })}
          </div>
        )}
      </div>

      {/* 圖表區 2: 負責人與地區分佈 (切換直條圖) */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <div className="flex items-center space-x-4">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">案件處理人員統計</h3>
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                <button onClick={() => setPersonnelViewMode('assignee')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${personnelViewMode === 'assignee' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>處理人員</button>
                <button onClick={() => setPersonnelViewMode('region')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${personnelViewMode === 'region' ? 'bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>群組</button>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-600">
            <Calendar size={16} className="text-slate-400 dark:text-slate-400 ml-2"/>
            <input type="date" value={personnelStartDate} onChange={e=>setPersonnelStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"/>
            <span className="text-slate-300 dark:text-slate-500">~</span>
            <input type="date" value={personnelEndDate} onChange={e=>setPersonnelEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer mr-2 [color-scheme:light] dark:[color-scheme:dark]"/>
          </div>
        </div>
        
        {Object.keys(personnelViewMode === 'assignee' ? dashboardStats.assigneeData : dashboardStats.regionData).length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-700/30 rounded-2xl mt-4">目前無相關資料。</div>
        ) : (
          <div className="flex h-[320px] items-end space-x-4 md:space-x-8 overflow-x-auto pb-4 pt-12 px-4">
            {Object.entries(personnelViewMode === 'assignee' ? dashboardStats.assigneeData : dashboardStats.regionData).sort((a,b)=>b[1]-a[1]).map(([key, count]) => {
                const currentData = personnelViewMode === 'assignee' ? dashboardStats.assigneeData : dashboardStats.regionData;
                const maxVal = Math.max(...Object.values(currentData), 1);
                const heightPct = (count / maxVal) * 100;
                const barColorClass = personnelViewMode === 'assignee' ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-emerald-500 dark:bg-emerald-400';
                const textColorClass = personnelViewMode === 'assignee' ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400';
                return (
                  <div key={key} className="group flex flex-col items-center justify-end h-full w-12 shrink-0 relative animate-in fade-in duration-500">
                    <div className="absolute -top-8 text-slate-900 dark:text-slate-800 bg-slate-100 dark:bg-slate-200 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap z-10 shadow-sm transition-transform transform group-hover:-translate-y-1">{count} 件</div>
                    <div className="w-10 bg-slate-100 dark:bg-slate-700 rounded-t-full h-full flex flex-col justify-end overflow-hidden relative group-hover:shadow-inner">
                      <div className={`w-full ${barColorClass} rounded-t-full transition-all duration-1000 ease-out group-hover:brightness-110`} style={{ height: `${heightPct}%` }}></div>
                    </div>
                    <div className={`text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-4 h-32 text-center leading-tight [writing-mode:vertical-rl] transition-colors tracking-widest select-none ${textColorClass}`}>{key}</div>
                  </div>
                );
            })}
          </div>
        )}
      </div>

      {/* 圖表區 3: 線型圖 (月趨勢) */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">近半年趨勢走勢圖</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">觀測各類別每月份案件數量波動</p>
          </div>
          <select value={trendCategory} onChange={e=>setTrendCategory(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="全類別">-- 綜合全類別 --</option>
            {(Array.isArray(categories)?categories:[]).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <LineChart 
          datasets={[
            { label: '總計', data: dashboardStats.trendData.total, color: '#94a3b8', dashed: true },
            { label: '電話', data: dashboardStats.trendData.phone, color: '#3b82f6' },
            { label: 'LINE', data: dashboardStats.trendData.line, color: '#10b981' },
            { label: '電話轉LINE', data: dashboardStats.trendData.phoneToLine, color: '#f59e0b' }
          ]} 
          labels={dashboardStats.monthLabels.map(m => m.replace('-','/'))} 
          isDarkMode={isDarkMode} 
        />
      </div>

    </div>
  );
};

export default DashboardArea;
