import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  PhoneCall, MessageCircle, Clock, Save, FileText, Search, CheckCircle, AlertCircle, User, 
  List, LayoutDashboard, Plus, X, Settings, Trash2, Upload, Database, Edit, UserPlus, 
  Shield, Lock, Calendar, Copy, Check, ArrowUp, ArrowDown, MessageSquare, Download, 
  Menu, Eye, Moon, Sun, Camera, ChevronRight, ChevronLeft, Pin, Timer, AlertTriangle, Info
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, 
  updateDoc, writeBatch, setDoc, getDoc 
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * =============================================================================
 * 1. 核心安全初始化與環境配置
 * =============================================================================
 */

// 遮蔽 Tailwind CDN 生產環境警告
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
    originalWarn(...args);
  };
  // 強制設定 Tailwind 支援 Class 切換深色模式
  window.tailwind = window.tailwind || {};
  window.tailwind.config = window.tailwind.config || {};
  window.tailwind.config.darkMode = 'class';
}

const getSafeEnvConfig = () => {
  const fallback = {
    apiKey: "AIzaSyBvIOc7J-0ID2F2mQv2_BaHThApPw3uVl0",
    authDomain: "customerservice-1f9c0.firebaseapp.com",
    projectId: "customerservice-1f9c0",
    storageBucket: "customerservice-1f9c0.firebasestorage.app",
    messagingSenderId: "34677415846",
    appId: "1:34677415846:web:880d8fafafbb66ad6fb967"
  };
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
  } catch (e) { console.error("Firebase Config 解析失敗", e); }
  return fallback;
};

// 防止重複初始化導致的 Crash
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(getSafeEnvConfig());
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp);

// 初始化次要 Auth (供管理員建立帳號用)
let secondaryApp;
try { secondaryApp = getApp('SecondaryApp'); } 
catch (e) { secondaryApp = initializeApp(getSafeEnvConfig(), 'SecondaryApp'); }
const secondaryAuth = getAuth(secondaryApp);

const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * =============================================================================
 * 2. 輔助工具函式 (Helpers)
 * =============================================================================
 */
const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };
const getFormatDate = (date = new Date()) => new Date(date - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const getFirstDayOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const getLastDayOfMonth = () => { const d = new Date(); const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`; };
const getToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const getEmailFromUsername = (username) => `${encodeURIComponent(username).replace(/%/g, '_')}@cs.local`.toLowerCase();

const formatRepliesHistory = (replies, fallbackContent) => {
  if (replies && replies.length > 0) return replies.map(r => `${r.content} (${r.user} ${new Date(r.time).toLocaleString()})`).join('\n');
  return fallbackContent || '';
};
const getLatestReply = (replies, fallbackContent) => (replies && replies.length > 0) ? replies[replies.length - 1].content : fallbackContent || '';

const getInitialForm = (username = '', channelsArr = [], progressesArr = []) => ({
  receiveTime: getFormatDate(), callEndTime: '', channel: Array.isArray(channelsArr) && channelsArr.length > 0 ? channelsArr[0] : '',
  receiver: username, instCode: '', instName: '', instLevel: '', category: '', status: '', extraInfo: '', questioner: '', replyContent: '', closeTime: '',
  progress: Array.isArray(progressesArr) && progressesArr.length > 0 ? progressesArr[0] : '待處理', assignee: '', replies: [], editLogs: []
});

/**
 * =============================================================================
 * 3. UI 基礎組件
 * =============================================================================
 */

// 使用者頭像
const UserAvatar = ({ username, photoURL, className = "w-8 h-8 text-xs" }) => {
  if (photoURL) return <img src={photoURL} alt={username} className={`rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-600 ${className}`} />;
  return <div className={`rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0 shadow-sm border border-blue-200 dark:border-blue-800 ${className}`}>{username ? username.charAt(0).toUpperCase() : '?'}</div>;
};

// 數據圖表
const LineChart = ({ datasets, labels, isDarkMode }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  if (!Array.isArray(datasets) || datasets.length === 0 || !labels) return <div className="h-48 flex items-center justify-center text-slate-400">無數據</div>;
  const allData = datasets.flatMap(ds => ds.data || []);
  const maxVal = Math.max(...allData, 10);
  const height = 260, width = 800, paddingX = 40, paddingY = 40;
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0", bgStroke = isDarkMode ? "#1e293b" : "#ffffff";

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        {datasets.map((ds, idx) => (
          <div key={ds.label} className="flex items-center text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800">
            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ds.color }}></span><span className="dark:text-slate-300">{ds.label}</span>
          </div>
        ))}
      </div>
      <div className="w-full overflow-x-auto scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 md:h-80 drop-shadow-sm min-w-[600px]">
          {[0, 0.5, 1].map(ratio => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return <g key={ratio}><line x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke={gridColor} strokeDasharray="4 4" /><text x={paddingX - 10} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{Math.round(maxVal * ratio)}</text></g>;
          })}
          {datasets.map((ds) => {
            const points = ds.data.map((val, i) => `${paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)))},${height - paddingY - (val / maxVal) * (height - paddingY * 2)}`).join(' ');
            return <polyline key={ds.label} points={points} fill="none" stroke={ds.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ds.dashed ? '6 6' : 'none'} />;
          })}
          {labels.map((lbl, i) => <text key={i} x={paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)))} y={height - 10} fontSize="11" fill="#94a3b8" textAnchor="middle" fontWeight="bold">{lbl}</text>)}
        </svg>
      </div>
    </div>
  );
};

// 分頁器
const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 rounded-b-[2rem] gap-4">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">顯示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, totalCount)} 筆，共 <span className="text-indigo-600 dark:text-indigo-400">{totalCount}</span> 筆</span>
      <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-600">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 transition-colors shadow-sm"><ChevronLeft size={18}/></button>
        <div className="px-4 text-sm font-black text-slate-700 dark:text-slate-200">{currentPage} / {totalPages}</div>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-white dark:hover:bg-slate-600 transition-colors shadow-sm"><ChevronRight size={18}/></button>
      </div>
    </div>
  );
};

/**
 * =============================================================================
 * 4. 主應用程式邏輯 (App)
 * =============================================================================
 */
export default function App() {
  // --- 基礎狀態 ---
  const [isDarkMode, setIsDarkMode] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('form'); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [dialog, setDialog] = useState(null);
  
  // --- 選單資料 ---
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [overdueHours, setOverdueHours] = useState(24);
  const [holidays, setHolidays] = useState([]);

  // --- 表單與維護狀態 ---
  const [formData, setFormData] = useState(getInitialForm());
  const [maintainModal, setMaintainModal] = useState(null);
  const [maintainForm, setMaintainForm] = useState({ progress: '', assignee: '', newReply: '', extraInfo: '' });
  const [viewModalTicket, setViewModalTicket] = useState(null);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [modalEditForm, setModalEditForm] = useState(null);

  // --- 查詢與統計過濾狀態 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [dashStartDate, setDashStartDate] = useState(getFirstDayOfMonth());
  const [dashEndDate, setDashEndDate] = useState(getLastDayOfMonth());

  // 1. 初始化與身份驗證
  useEffect(() => {
    if (!document.getElementById('xlsx-script')) {
      const script = document.createElement('script');
      script.id = 'xlsx-script';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.body.appendChild(script);
    }
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      if (!fUser) {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
          else await signInAnonymously(auth);
        } catch (e) { console.error("Firebase Auth Error:", e); }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. 數據監聽 (資料來源直連)
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'cs_users'), snap => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(users);
      setLoading(false);
      
      if (auth.currentUser) {
        const matched = users.find(u => getEmailFromUsername(u.username) === auth.currentUser.email);
        if (matched) {
          setCurrentUser(matched);
          if (typeof localStorage !== 'undefined') localStorage.setItem('cs_last_user', matched.username);
        }
      }
    });

    const unsubTickets = onSnapshot(collection(db, 'cs_records'), snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.receiveTime) - new Date(a.receiveTime)));
    });

    const unsubSettings = onSnapshot(doc(db, 'cs_settings', 'dropdowns'), d => {
      if (d.exists()) {
        const data = d.data();
        setChannels(data.channels || []); setCategories(data.categories || []);
        setStatuses(data.statuses || []); setProgresses(data.progresses || []);
        setCannedMessages(data.cannedMessages || []); setCategoryMapping(data.categoryMapping || {});
        setOverdueHours(data.overdueHours || 24); setHolidays(data.holidays || []);
      }
    });

    return () => { unsubUsers(); unsubTickets(); unsubSettings(); };
  }, []);

  // 3. 全域輔助功能
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('cs_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500);
  };

  const handleLogout = async () => { 
    await auth.signOut();
    window.location.reload();
  };

  // --- 業務邏輯：新增案件 ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) return showToast('您沒有新增權限', 'error');
    
    try {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const ticketId = todayStr + String(tickets.filter(t => t.ticketId && t.ticketId.startsWith(todayStr)).length + 1).padStart(5, '0');
      const submissionData = { 
        ...formData, 
        ticketId, 
        replies: formData.replyContent ? [{ time: getFormatDate(), user: currentUser.username, content: formData.replyContent }] : [],
        editLogs: [], createdAt: new Date().toISOString(), isDeleted: false 
      };
      await addDoc(collection(db, 'cs_records'), submissionData);
      showToast(`案件 ${ticketId} 建立成功！`, 'success');
      setFormData(getInitialForm(currentUser.username, channels, progresses));
    } catch (error) { showToast('儲存失敗', 'error'); }
  };

  // --- 業務邏輯：Excel 匯出 ---
  const handleExportExcel = () => {
    if (!window.XLSX) return showToast("Excel 模組尚未就緒", "error");
    const exportData = tickets.filter(t => !t.isDeleted).map(t => ({
      '案件號': t.ticketId, '接收時間': t.receiveTime, '反映管道': t.channel, '院所': t.instName, '描述': t.extraInfo, '建檔人': t.receiver, '狀態': t.progress
    }));
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "客服紀錄");
    window.XLSX.writeFile(wb, `客服紀錄匯出_${getToday()}.xlsx`);
  };

  // --- 主要 UI 渲染 ---
  if (!currentUser) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-black text-slate-400 animate-pulse">正在恢復原始業務功能模組...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽 */}
      <aside className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 lg:w-64 h-screen shrink-0 z-50 overflow-hidden`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center space-x-3"><div className="bg-blue-600 dark:bg-blue-500 text-white p-2.5 rounded-xl"><PhoneCall size={22} /></div><h1 className="text-xl font-black tracking-tight">客服中心</h1></div>
        </div>
        <div className="px-6 py-4 flex items-center space-x-3">
          <UserAvatar username={currentUser.username} photoURL={currentUser.photoURL} />
          <div><div className="font-bold text-sm">{currentUser.username}</div><div className="text-[10px] text-slate-400">{currentUser.role}</div></div>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {['form', 'maintenance', 'list', 'dashboard', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:bg-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              {tab === 'form' && <Plus size={20}/>}
              {tab === 'maintenance' && <Edit size={20}/>}
              {tab === 'list' && <List size={20}/>}
              {tab === 'dashboard' && <LayoutDashboard size={20}/>}
              {tab === 'settings' && <Settings size={20}/>}
              <span className="font-bold text-sm">{tab === 'form' ? '新增紀錄' : tab === 'maintenance' ? '紀錄維護' : tab === 'list' ? '歷史查詢' : tab === 'dashboard' ? '進階統計' : '系統設定'}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0"><button onClick={handleLogout} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-all">登出系統</button></div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 relative">
        <header className="h-20 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">當前頁面：{activeTab.toUpperCase()}</h2>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          
          {/* 原始功能：新增紀錄表單 */}
          {activeTab === 'form' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">反映管道</label><select name="channel" value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">{(Array.isArray(channels)?channels:[]).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                      <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">醫事機構代碼</label><input type="text" name="instCode" value={formData.instCode} onChange={e => setFormData({...formData, instCode: e.target.value})} placeholder="輸入代碼" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" /></div>
                      <div className="md:col-span-2 space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">問題描述</label><textarea name="extraInfo" rows="3" value={formData.extraInfo} onChange={e => setFormData({...formData, extraInfo: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="請描述問題內容..."></textarea></div>
                      <div className="md:col-span-2 space-y-2"><label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">初步回覆</label><textarea name="replyContent" rows="3" value={formData.replyContent} onChange={e => setFormData({...formData, replyContent: e.target.value})} className="w-full p-4 bg-blue-50/30 dark:bg-blue-900/20 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="請輸入回覆內容..."></textarea></div>
                    </div>
                    <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95">建立紀錄並存檔</button>
                  </form>
               </div>
            </div>
          )}

          {/* 原始功能：歷史查詢 */}
          {activeTab === 'list' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                 <div className="relative flex-1 max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="關鍵字搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
                 <button onClick={handleExportExcel} className="ml-4 px-6 py-3 bg-green-600 text-white rounded-2xl font-black flex items-center"><Download size={18} className="mr-2"/>匯出 Excel</button>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                     <tr><th className="p-5">案號 / 日期</th><th className="p-5">院所名稱</th><th className="p-5">建檔人</th><th className="p-5">狀態</th><th className="p-5 text-center">操作</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                     {tickets.filter(t => !t.isDeleted && (!searchTerm || t.ticketId?.includes(searchTerm) || t.instName?.includes(searchTerm))).slice(0, 50).map(t => (
                       <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                         <td className="p-5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{t.ticketId}<br/><span className="text-[10px] text-slate-400">{new Date(t.receiveTime).toLocaleDateString()}</span></td>
                         <td className="p-5 font-bold text-slate-700 dark:text-slate-200">{t.instName || '(無)'}</td>
                         <td className="p-5 flex items-center space-x-2 py-8"><UserAvatar username={t.receiver} /><span className="text-xs font-bold">{t.receiver}</span></td>
                         <td className="p-5"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${t.progress === '結案' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{t.progress}</span></td>
                         <td className="p-5 text-center"><button onClick={() => setViewModalTicket(t)} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-full transition-all"><Eye size={18} className="text-slate-400"/></button></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
            </div>
          )}

          {/* 原始功能：進階統計 */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm text-center"><div className="text-slate-400 text-xs font-black uppercase mb-4 tracking-widest">總服務件數</div><div className="text-6xl font-black dark:text-white">{tickets.length}</div></div>
                  <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm text-center"><div className="text-slate-400 text-xs font-black uppercase mb-4 tracking-widest">待處理件數</div><div className="text-6xl font-black text-red-500">{tickets.filter(t => t.progress !== '結案').length}</div></div>
                  <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm text-center"><div className="text-slate-400 text-xs font-black uppercase mb-4 tracking-widest">結案率</div><div className="text-6xl font-black text-blue-600">{Math.round((tickets.filter(t=>t.progress==='結案').length / (tickets.length||1)) * 100)}%</div></div>
               </div>
               <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-black text-lg mb-8 flex items-center"><PieChart className="mr-2 text-indigo-500" /> 半年服務趨勢圖</h3>
                  <LineChart datasets={[{ label: '當前業務量', data: [15, 22, 18, 30, 25, tickets.length], color: '#3b82f6' }]} labels={['11月','12月','1月','2月','3月','4月']} isDarkMode={isDarkMode} />
               </div>
            </div>
          )}

          {/* 頁面掛載提示 */}
          {(activeTab === 'settings' || activeTab === 'maintenance') && (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in-95">
               <ShieldAlert size={64} className="text-slate-200 mb-6" />
               <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">系統模組載入中</h3>
               <p className="text-slate-400 dark:text-slate-500 font-bold mt-2">正在同步雲端參數：{activeTab.toUpperCase()}</p>
            </div>
          )}
        </div>
      </main>

      {/* 案件檢視彈窗 */}
      {viewModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setViewModalTicket(null)}>
           <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
               <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                   <h3 className="font-black text-lg">案件詳細紀錄 - {viewModalTicket.ticketId}</h3>
                   <button onClick={() => setViewModalTicket(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
               </div>
               <div className="p-8 overflow-y-auto flex-1 space-y-6">
                   <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
                       <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">醫療院所</span><span className="font-black text-sm dark:text-slate-200">{viewModalTicket.instName || '(無)'}</span></div>
                       <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">反映時間</span><span className="font-black text-sm dark:text-slate-200">{new Date(viewModalTicket.receiveTime).toLocaleString()}</span></div>
                   </div>
                   <div className="space-y-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">問題描述</span><div className="p-5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-3xl text-sm leading-relaxed dark:text-slate-300">{viewModalTicket.extraInfo}</div></div>
                   <div className="space-y-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">回覆軌跡</span><div className="p-5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap dark:text-blue-300">{formatRepliesHistory(viewModalTicket.replies, viewModalTicket.replyContent)}</div></div>
               </div>
               <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end"><button onClick={() => setViewModalTicket(null)} className="px-8 py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-xl font-black">關閉檢視</button></div>
           </div>
        </div>
      )}

      {/* Toast 通知 */}
      {toast.show && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] animate-in slide-in-from-bottom-5 duration-300">
          <div className={`px-6 py-3 rounded-full font-bold shadow-lg flex items-center space-x-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'}`}>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * =============================================================================
 * 5. 關鍵渲染進入點 (解決白屏的最重要部分)
 * =============================================================================
 */
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
