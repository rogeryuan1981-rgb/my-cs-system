import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut, updatePassword 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, writeBatch, query, where 
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  User, Settings, Camera, UserPlus, Timer, Calendar, Trash2, Plus, Upload, List,
  Search, Filter, Download, ArrowUpDown, ChevronLeft, Save, ShieldAlert, Edit, Info, Eye, Pin, PhoneCall
} from 'lucide-react';

/**
 * =============================================================================
 * 1. 核心安全初始化與環境配置
 * =============================================================================
 */

// 遮蔽 Tailwind CDN 生產環境警告，維持 Console 乾淨
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
    originalWarn(...args);
  };
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

// 全域實例 (防衝突命名)
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(getSafeEnvConfig());
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp);
const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * =============================================================================
 * 2. 輔助工具函式 (Helpers)
 * =============================================================================
 */
const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };
const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const getLastDayOfMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};
const formatRepliesHistory = (replies, fallback) => {
  if (replies && replies.length > 0) return replies.map(r => `[${r.user}]: ${r.content}`).join('\n');
  return fallback || '';
};

// 自訂 Hook: 防抖動
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

/**
 * =============================================================================
 * 3. 核心子組件 (整合至單一檔案以解決載入問題)
 * =============================================================================
 */

// 使用者頭像
const UserAvatar = ({ username, photoURL, className = "w-8 h-8 text-xs" }) => {
  if (photoURL) return <img src={photoURL} alt={username} className={`rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-600 ${className}`} />;
  return <div className={`rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0 shadow-sm border border-blue-200 dark:border-blue-800 ${className}`}>{username ? username.charAt(0).toUpperCase() : '?'}</div>;
};

// 簡單折線圖 (Dashboard)
const LineChart = ({ datasets, labels, isDarkMode }) => {
  if (!labels || labels.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400">尚無數據</div>;
  const height = 200, width = 600, padding = 30;
  const maxVal = Math.max(...datasets.flatMap(ds => ds.data), 5);
  const getX = (i) => padding + (i * (width - padding * 2) / (labels.length - 1 || 1));
  const getY = (v) => height - padding - (v / maxVal * (height - padding * 2));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px] h-auto drop-shadow-sm">
        {datasets.map((ds, dsIdx) => (
          <polyline key={dsIdx} fill="none" stroke={ds.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ds.dashed ? "5,5" : "0"}
            points={ds.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ')} />
        ))}
        {labels.map((l, i) => <text key={i} x={getX(i)} y={height - 5} fontSize="10" textAnchor="middle" fill="#94a3b8" fontWeight="bold">{l.split('-')[1]}月</text>)}
      </svg>
    </div>
  );
};

// 分頁器
const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalCount === 0 || totalPages <= 1) return null;
  return (
    <div className="flex justify-between items-center px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
      <span className="text-xs font-bold text-slate-400">共 {totalCount} 筆</span>
      <div className="flex items-center space-x-2">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 rounded hover:bg-white disabled:opacity-30"><ChevronLeft size={16}/></button>
        <span className="text-xs font-black">{currentPage} / {totalPages}</span>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-white disabled:opacity-30"><ChevronRight size={16}/></button>
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
  // --- A. 基礎狀態 ---
  const [currentUser, setCurrentUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [initError, setInitError] = useState(null);

  // --- B. 數據狀態 ---
  const [tickets, setTickets] = useState([]);
  const [instMap, setInstMap] = useState({});
  const [dropdowns, setDropdowns] = useState({ 
    channels: [], categories: [], statuses: [], progresses: [], cannedMessages: [], categoryMapping: {}, overdueHours: 24 
  });

  // --- C. 篩選與搜尋狀態 ---
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');

  // --- D. UI 彈窗狀態 ---
  const [viewTicket, setViewTicket] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // 1. 初始化與認證
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { setInitError(err.message); }
    };
    initAuth();

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user && !currentUser) {
        setCurrentUser({ id: user.uid, username: '載入中...', role: ROLES.USER });
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. 數據監聽 (依照安全性規則路徑)
  useEffect(() => {
    if (!auth.currentUser) return;
    
    // 監聽使用者
    const unsubUsers = onSnapshot(collection(db, 'artifacts', currentAppId, 'public', 'data', 'cs_users'), (snap) => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(users);
      const map = {}; users.forEach(u => map[u.username] = u); setUserMap(map);
      
      const lastUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cs_last_user') : null;
      const matched = users.find(u => u.username === lastUser) || users[0];
      if (matched) setCurrentUser(matched);
      else setCurrentUser({ id: auth.currentUser.uid, username: '管理員(預設)', role: ROLES.ADMIN });
    });

    // 監聽案件
    const unsubTickets = onSnapshot(collection(db, 'artifacts', currentAppId, 'public', 'data', 'cs_records'), (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.receiveTime) - new Date(a.receiveTime)));
    });

    // 監聽設定
    const unsubSettings = onSnapshot(doc(db, 'artifacts', currentAppId, 'public', 'data', 'cs_settings', 'dropdowns'), (d) => {
      if (d.exists()) setDropdowns(d.data());
    });

    return () => { unsubUsers(); unsubTickets(); unsubSettings(); };
  }, [auth.currentUser]);

  // 3. 主題切換
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('cs_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  // 4. 數據過濾邏輯
  const filteredHistory = useMemo(() => {
    return tickets.filter(t => {
      if (t.isDeleted) return false;
      const matchSearch = !debouncedSearch || (t.ticketId||'').includes(debouncedSearch) || (t.instName||'').includes(debouncedSearch) || (t.extraInfo||'').includes(debouncedSearch);
      const matchProgress = historyProgress === '全部' || t.progress === historyProgress;
      const matchDate = (!historyStartDate || t.receiveTime >= historyStartDate) && (!historyEndDate || t.receiveTime <= historyEndDate + 'T23:59');
      return matchSearch && matchProgress && matchDate;
    });
  }, [tickets, debouncedSearch, historyProgress, historyStartDate, historyEndDate]);

  // 5. 渲染區塊
  if (!currentUser) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-black text-slate-400 animate-pulse">核心功能掛載中...</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'new', label: '新增紀錄', icon: Plus },
    { id: 'maintain', label: '案件維護', icon: Wrench },
    { id: 'list', label: '歷史查詢', icon: History },
    { id: 'dashboard', label: '進階統計', icon: PieChart },
    { id: 'settings', label: '系統設定', icon: Settings }
  ];

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <h1 className={`font-black text-white tracking-widest flex items-center ${sidebarOpen ? 'text-xl' : 'text-xs'}`}>
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "客服系統"}
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 space-y-2 px-3">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center p-3.5 rounded-2xl transition-all group ${isActive ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-black shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                <Icon size={20} className={sidebarOpen ? "mr-4" : "mx-auto"} />
                {sidebarOpen && <span className="truncate">{tab.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{currentUser.username}</div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-50 bg-slate-200 dark:bg-slate-700 px-1.5 rounded mt-0.5 inline-block">{currentUser.role}</div>
              </div>
            )}
            <button onClick={() => signOut(auth).then(()=>window.location.reload())} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 relative">
        <header className="h-20 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hidden md:block"><Menu size={20} /></button>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{TABS.find(t => t.id === activeTab)?.label}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          
          {/* TAB: NEW TICKET */}
          {activeTab === 'new' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                <form className="space-y-6" onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const data = Object.fromEntries(fd);
                  const ticketId = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}${String(tickets.length + 1).padStart(4,'0')}`;
                  addDoc(collection(db, 'artifacts', currentAppId, 'public', 'data', 'cs_records'), {
                    ...data, ticketId, createdAt: new Date().toISOString(), isDeleted: false, replies: [{ user: currentUser.username, time: new Date().toISOString(), content: data.replyContent }], receiver: currentUser.username
                  }).then(() => { showToast("紀錄已成功存入雲端", "success"); e.target.reset(); });
                }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">反映管道</label>
                      <select name="channel" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">
                        {dropdowns.channels.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">醫事機構名稱/代碼</label>
                      <input name="instName" placeholder="輸入名稱或代碼" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">業務類別</label>
                      <select name="category" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">
                        {dropdowns.categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">目前進度</label>
                      <select name="progress" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">
                        {dropdowns.progresses.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">詳細問題描述</label>
                    <textarea name="extraInfo" rows="3" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">給予的答覆</label>
                    <textarea name="replyContent" rows="3" className="w-full p-4 bg-blue-50/50 dark:bg-blue-900/20 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95">建立案件並存檔</button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: LIST */}
          {activeTab === 'list' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">關鍵字搜尋</label>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="案號、內容..." /></div>
                </div>
                <div className="flex gap-2">
                  <input type="date" value={historyStartDate} onChange={e=>setHistoryStartDate(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold" />
                  <input type="date" value={historyEndDate} onChange={e=>setHistoryEndDate(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold" />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="p-5">案號 / 院所</th><th className="p-5">類別</th><th className="p-5">建檔人員</th><th className="p-5">狀態</th><th className="p-5 text-center">操作</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                    {filteredHistory.slice(0, 50).map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => setViewTicket(t)}>
                        <td className="p-5"><div className="font-mono text-[10px] text-blue-500 font-black">{t.ticketId}</div><div className="text-sm font-black text-slate-700 dark:text-slate-200">{t.instName}</div></td>
                        <td className="p-5"><span className="text-xs font-bold text-slate-500">{t.category}</span></td>
                        <td className="p-5 flex items-center space-x-2 py-6"><UserAvatar username={t.receiver} photoURL={userMap[t.receiver]?.photoURL} className="w-6 h-6" /><span className="text-xs font-bold text-slate-600">{t.receiver}</span></td>
                        <td className="p-5"><span className={`px-2 py-1 rounded-md text-[10px] font-black ${t.progress==='結案'?'bg-emerald-100 text-emerald-600':'bg-orange-100 text-orange-600'}`}>{t.progress}</span></td>
                        <td className="p-5 text-center text-slate-300"><Eye size={18} className="mx-auto" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination currentPage={1} totalCount={filteredHistory.length} pageSize={50} onPageChange={()=>{}} />
              </div>
            </div>
          )}

          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700"><div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">總服務件數</div><div className="text-4xl font-black text-slate-800 dark:text-slate-100">{tickets.length}</div></div>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700"><div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">待處理案件</div><div className="text-4xl font-black text-red-500">{tickets.filter(t=>t.progress!=='結案').length}</div></div>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700"><div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">結案率</div><div className="text-4xl font-black text-emerald-500">{Math.round((tickets.filter(t=>t.progress==='結案').length / (tickets.length||1)) * 100)}%</div></div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-black mb-8 flex items-center"><PieChart className="mr-2 text-indigo-500" /> 近半年服務趨勢 (雙通道統計)</h3>
                <LineChart datasets={[{ label: '總件數', data: [12, 19, 15, 22, 18, tickets.length], color: '#3b82f6' }]} labels={['11月','12月','1月','2月','3月','4月']} isDarkMode={isDarkMode} />
              </div>
            </div>
          )}

          {/* TAB: SETTINGS (Admin ONLY for simplicity here) */}
          {activeTab === 'settings' && (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm max-w-2xl mx-auto mt-12">
               <Settings size={48} className="mx-auto text-slate-400 mb-6" />
               <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">系統配置管理</h3>
               <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">管理員可在此維護下拉選單、成員權限與國定假日排除設定。</p>
               <div className="grid grid-cols-2 gap-4">
                 <button className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-bold text-xs hover:bg-blue-50 transition-all">下拉選單管理</button>
                 <button className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-bold text-xs hover:bg-blue-50 transition-all">成員權限維護</button>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* 案件檢視彈窗 */}
      {viewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setViewTicket(null)}>
           <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
               <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                   <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">案件詳細紀錄 - {viewTicket.ticketId}</h3>
                   <button onClick={() => setViewTicket(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
               </div>
               <div className="p-8 overflow-y-auto space-y-6">
                   <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
                       <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">醫療院所</span><span className="font-black text-sm">{viewTicket.instName}</span></div>
                       <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">反映時間</span><span className="font-black text-sm">{new Date(viewTicket.receiveTime).toLocaleString()}</span></div>
                   </div>
                   <div className="space-y-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">客戶反映內容</span>
                       <div className="p-5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-3xl text-sm leading-relaxed">{viewTicket.extraInfo}</div>
                   </div>
                   <div className="space-y-2">
                       <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block ml-1">系統回覆與軌跡</span>
                       <div className="p-5 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap">{formatRepliesHistory(viewTicket.replies, viewTicket.replyContent)}</div>
                   </div>
               </div>
               <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0"><button onClick={() => setViewTicket(null)} className="px-8 py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-xl font-black">關閉檢視</button></div>
           </div>
        </div>
      )}

      {/* Toast 通知系統 */}
      {toast.show && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] animate-in slide-in-from-bottom-5 duration-300">
          <div className={`px-6 py-3 rounded-full font-bold shadow-lg flex items-center space-x-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * =============================================================================
 * 5. 關鍵渲染進入點
 * =============================================================================
 */
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
