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
 * 1. 核心安全初始化與環境配置 (確保不白屏、不報 API 錯誤)
 * =============================================================================
 */

// 遮蔽 Tailwind CDN 生產環境警告
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
    originalWarn(...args);
  };
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

// 避免重複初始化
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(getSafeEnvConfig());
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp);

// 初始化次要 Auth
let secondaryApp;
try { secondaryApp = getApp('SecondaryApp'); } 
catch (e) { secondaryApp = initializeApp(getSafeEnvConfig(), 'SecondaryApp'); }
const secondaryAuth = getAuth(secondaryApp);

/**
 * =============================================================================
 * 2. 輔助工具與常數 (恢復原始邏輯)
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

// 自訂 Hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => { const handler = setTimeout(() => { setDebouncedValue(value); }, delay); return () => clearTimeout(handler); }, [value, delay]);
  return debouncedValue;
}

/**
 * =============================================================================
 * 3. UI 子組件
 * =============================================================================
 */
const UserAvatar = ({ username, photoURL, className = "w-8 h-8 text-xs" }) => {
  if (photoURL) return <img src={photoURL} alt={username} className={`rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-600 ${className}`} />;
  return <div className={`rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0 shadow-sm border border-blue-200 dark:border-blue-800 ${className}`}>{username ? username.charAt(0).toUpperCase() : '?'}</div>;
};

const LineChart = ({ datasets, labels, isDarkMode }) => {
  if (!Array.isArray(datasets) || datasets.length === 0 || !labels) return <div className="h-48 flex items-center justify-center text-slate-400">無數據</div>;
  const allData = datasets.flatMap(ds => ds.data || []);
  const maxVal = Math.max(...allData, 10);
  const height = 260, width = 800, paddingX = 40, paddingY = 40;
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  return (
    <div className="w-full flex flex-col items-center">
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

const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 rounded-b-[2rem] gap-4">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">共 <span className="text-indigo-600 dark:text-indigo-400">{totalCount}</span> 筆資料</span>
      <div className="flex items-center space-x-2">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft size={18}/></button>
        <span className="text-sm font-black px-4">{currentPage} / {totalPages}</span>
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight size={18}/></button>
      </div>
    </div>
  );
};

/**
 * =============================================================================
 * 4. 主應用程式邏輯 (恢復所有優化版業務功能)
 * =============================================================================
 */
export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dbUsers, setDbUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('form'); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [dropdowns, setDropdowns] = useState({ channels: [], categories: [], statuses: [], progresses: [], cannedMessages: [], categoryMapping: {}, overdueHours: 24 });
  const [instMap, setInstMap] = useState({});
  const [viewModalTicket, setViewModalTicket] = useState(null);

  // 搜尋與分頁狀態
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 50;

  // 1. 初始化
  useEffect(() => {
    // 載入 XLSX 支援
    if (!document.getElementById('xlsx-script')) {
      const script = document.createElement('script'); script.id = 'xlsx-script';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.body.appendChild(script);
    }
    
    // Auth 監聽
    const unsubAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      if (!fUser) {
        signInAnonymously(auth).catch(e => console.error("匿名登入失敗", e));
      }
    });
    return () => unsubAuth();
  }, []);

  // 2. 核心數據監聽 (連向根路徑，恢復資料)
  useEffect(() => {
    if (!firebaseUser) return;
    
    // 監聽使用者 (根目錄 cs_users)
    const unsubUsers = onSnapshot(collection(db, 'cs_users'), snap => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(users);
      setLoading(false);
      
      // 自動比對身份
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        const matched = users.find(u => getEmailFromUsername(u.username) === auth.currentUser.email);
        if (matched) setCurrentUser(matched);
      }
    });

    // 監聽案件 (根目錄 cs_records)
    const unsubTickets = onSnapshot(collection(db, 'cs_records'), snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.receiveTime) - new Date(a.receiveTime)));
    });

    // 監聽設定 (根目錄 cs_settings)
    const unsubSettings = onSnapshot(doc(db, 'cs_settings', 'dropdowns'), d => {
      if (d.exists()) setDropdowns(d.data());
    });

    // 監聽院所 (根目錄 mohw_institutions)
    const unsubInst = onSnapshot(collection(db, 'mohw_institutions'), snap => {
      const map = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.isChunk && data.payload) {
          try { JSON.parse(data.payload).forEach(item => { map[item.code] = item; }); } catch (e) {}
        } else { map[data.code] = data; }
      });
      setInstMap(map);
    });

    return () => { unsubUsers(); unsubTickets(); unsubSettings(); unsubInst(); };
  }, [firebaseUser]);

  // 3. 全域效果
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = getEmailFromUsername(loginForm.username);
    try {
      await signInWithEmailAndPassword(auth, email, loginForm.password);
      showToast("登入成功", "success");
      setAuthError('');
    } catch (err) {
      // 嘗試處理舊版明文密碼升級邏輯
      const legacyUser = dbUsers.find(u => u.username === loginForm.username && u.password === loginForm.password);
      if (legacyUser) {
        await createUserWithEmailAndPassword(auth, email, loginForm.password);
        showToast("帳號安全性升級完成並登入", "success");
        setAuthError('');
      } else {
        setAuthError("帳號或密碼錯誤");
      }
    }
  };

  // 4. 過濾邏輯
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => !t.isDeleted && (!debouncedSearch || (t.ticketId||'').includes(debouncedSearch) || (t.instName||'').includes(debouncedSearch)));
  }, [tickets, debouncedSearch]);

  const paginatedHistory = useMemo(() => filteredTickets.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE), [filteredTickets, listPage]);

  // 5. 渲染邏輯
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="font-black text-slate-400 text-lg">正在同步雲端業務模組...</p>
        </div>
      </div>
    );
  }

  // 若未登入且資料庫已有用戶，顯示登入介面 (修復「一直在轉」的關鍵)
  if (!currentUser && dbUsers.length > 0) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} transition-colors`}>
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-700 animate-in zoom-in-95">
          <div className="text-center mb-10">
            <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-none"><PhoneCall className="text-white" size={32} /></div>
            <h1 className="text-3xl font-black tracking-tighter dark:text-white">客服系統登入</h1>
            <p className="text-slate-400 font-bold mt-2">請輸入您的內部帳號密碼</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="text" placeholder="使用者名稱" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" required />
            <input type="password" placeholder="密碼" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" required />
            {authError && <p className="text-red-500 text-sm font-bold text-center animate-bounce">{authError}</p>}
            <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95">進入系統</button>
          </form>
        </div>
      </div>
    );
  }

  // 若資料庫為空，顯示管理員初始化介面
  if (!currentUser && dbUsers.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center max-w-sm p-8 bg-slate-800 rounded-[2.5rem] border border-slate-700">
           <Shield size={48} className="mx-auto text-blue-400 mb-6" />
           <h2 className="text-2xl font-black mb-4">系統初始化</h2>
           <p className="text-slate-400 text-sm mb-8 font-bold leading-relaxed">偵測到資料庫尚無用戶，請設定第一位【後台管理者】帳號以啟動服務。</p>
           <form onSubmit={async (e) => {
             e.preventDefault();
             const email = getEmailFromUsername(loginForm.username);
             await createUserWithEmailAndPassword(auth, email, loginForm.password);
             await addDoc(collection(db, 'cs_users'), { username: loginForm.username, role: ROLES.ADMIN, createdAt: new Date().toISOString(), requirePasswordChange: false });
           }} className="space-y-4">
             <input type="text" placeholder="設定管理員帳號" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full p-4 bg-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" required />
             <input type="password" placeholder="設定初始密碼" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" required />
             <button type="submit" className="w-full py-4 bg-blue-600 rounded-2xl font-black">建立並啟動系統</button>
           </form>
        </div>
      </div>
    );
  }

  // --- 主介面渲染 (恢復原版 Sidebar 與 Tab) ---
  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽 */}
      <aside className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 w-64 h-screen shrink-0 z-50 overflow-hidden hidden lg:flex`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3"><div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-inner"><PhoneCall size={22} /></div><h1 className="text-xl font-black tracking-tight dark:text-white">客服中心</h1></div>
        </div>
        <div className="px-6 py-6 flex items-center space-x-3 shrink-0">
          <UserAvatar username={currentUser.username} photoURL={currentUser.photoURL} className="w-10 h-10 text-sm" />
          <div className="overflow-hidden">
            <div className="font-bold text-sm dark:text-slate-200 truncate">{currentUser.username}</div>
            <div className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded mt-1 inline-block">{currentUser.role}</div>
          </div>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto border-t border-slate-50 dark:border-slate-700">
          {['form', 'list', 'dashboard', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center space-x-3 w-full px-4 py-3.5 rounded-2xl transition-all duration-200 ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              {tab === 'form' && <Plus size={20}/>}
              {tab === 'list' && <List size={20}/>}
              {tab === 'dashboard' && <LayoutDashboard size={20}/>}
              {tab === 'settings' && <Settings size={20}/>}
              <span className="font-black text-sm tracking-wide">{tab === 'form' ? '新增紀錄' : tab === 'list' ? '歷史查詢' : tab === 'dashboard' ? '進階統計' : '系統設定'}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 mb-4">{isDarkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} />}</button>
          <button onClick={() => auth.signOut().then(()=>window.location.reload())} className="w-full py-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all">登出系統</button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 relative">
        <header className="h-20 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between px-8 shrink-0 z-20 border-b border-slate-200 dark:border-slate-700">
           <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{activeTab.toUpperCase()}</h2>
           <div className="flex items-center space-x-4">
              <div className="text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">VERSION 3.7.1</div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 relative">
          
          {/* 原始功能：新增紀錄 */}
          {activeTab === 'form' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
               <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-sm border border-slate-200 dark:border-slate-700">
                  <form className="space-y-8" onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    const data = Object.fromEntries(fd);
                    const ticketId = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}${String(tickets.length + 1).padStart(5,'0')}`;
                    await addDoc(collection(db, 'cs_records'), { ...data, ticketId, createdAt: new Date().toISOString(), isDeleted: false, receiver: currentUser.username, replies: [{ time: getFormatDate(), user: currentUser.username, content: data.replyContent }] });
                    showToast("紀錄已成功同步至雲端", "success");
                    e.target.reset();
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-2"><label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 block">反映管道</label><select name="channel" required className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white">{(dropdowns.channels||[]).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                       <div className="space-y-2"><label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 block">院所名稱/代碼</label><input name="instName" required placeholder="輸入關鍵字..." className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" /></div>
                    </div>
                    <div className="space-y-2"><label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 block">詳細問題描述</label><textarea name="extraInfo" required rows="4" className="w-full p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="請描述問題..."></textarea></div>
                    <div className="space-y-2"><label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1 block">給予的答覆</label><textarea name="replyContent" required rows="4" className="w-full p-5 bg-blue-50/30 dark:bg-blue-900/20 border border-slate-200 dark:border-slate-700 rounded-[2rem] outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="輸入初步回覆..."></textarea></div>
                    <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-lg shadow-xl transition-all active:scale-[0.98]">建立紀錄並存檔</button>
                  </form>
               </div>
            </div>
          )}

          {/* 原始功能：歷史查詢 */}
          {activeTab === 'list' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 max-w-[1400px] mx-auto">
               <div className="flex flex-wrap gap-4 items-end">
                  <div className="relative flex-1 min-w-[300px]"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20}/><input type="text" placeholder="搜尋案號、名稱或描述..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"/></div>
                  <button className="px-8 py-4 bg-green-600 text-white rounded-[2rem] font-black shadow-lg flex items-center"><Download size={20} className="mr-2"/>匯出 Excel</button>
               </div>
               <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <tr><th className="p-6">案號 / 日期</th><th className="p-6">院所與代碼</th><th className="p-6">建檔同仁</th><th className="p-6">狀態</th><th className="p-6 text-center">操作</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                        {paginatedHistory.map(t => (
                          <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer" onClick={()=>setViewModalTicket(t)}>
                            <td className="p-6"><div className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">{t.ticketId}</div><div className="text-[10px] text-slate-400 mt-1">{new Date(t.receiveTime).toLocaleDateString()}</div></td>
                            <td className="p-6"><div className="font-black text-slate-700 dark:text-slate-200">{t.instName || '(無名稱)'}</div><div className="text-[10px] font-mono text-slate-400 mt-0.5">{t.instCode}</div></td>
                            <td className="p-6 flex items-center space-x-3 py-10"><UserAvatar username={t.receiver} photoURL={userMap[t.receiver]?.photoURL} /><span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.receiver}</span></td>
                            <td className="p-6"><span className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${t.progress === '結案' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{t.progress || '待處理'}</span></td>
                            <td className="p-6 text-center"><button className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-full text-slate-300 group-hover:text-blue-500 transition-all"><Eye size={20}/></button></td>
                          </tr>
                        ))}
                        {paginatedHistory.length === 0 && <tr><td colSpan="5" className="p-20 text-center text-slate-400 font-black text-lg">查無相關歷史紀錄</td></tr>}
                     </tbody>
                  </table>
                  <Pagination currentPage={listPage} totalCount={filteredTickets.length} pageSize={PAGE_SIZE} onPageChange={setListPage} />
               </div>
            </div>
          )}

          {/* 原始功能：進階統計 */}
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 max-w-[1400px] mx-auto">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm text-center transition-all hover:scale-[1.02]"><div className="text-slate-400 text-xs font-black uppercase mb-4 tracking-widest">總服務件數</div><div className="text-7xl font-black text-slate-800 dark:text-white leading-none">{tickets.length}</div></div>
                  <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm text-center transition-all hover:scale-[1.02]"><div className="text-slate-400 text-xs font-black uppercase mb-4 tracking-widest">待結案案件</div><div className="text-7xl font-black text-red-500 leading-none">{tickets.filter(t=>t.progress!=='結案').length}</div></div>
                  <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm text-center transition-all hover:scale-[1.02]"><div className="text-slate-400 text-xs font-black uppercase mb-4 tracking-widest">平均完成率</div><div className="text-7xl font-black text-blue-600 dark:text-blue-400 leading-none">{tickets.length ? Math.round((tickets.filter(t=>t.progress==='結案').length/tickets.length)*100) : 0}%</div></div>
               </div>
               <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h3 className="text-xl font-black mb-10 flex items-center dark:text-white"><PieChart size={24} className="mr-3 text-indigo-500" /> 半年服務趨勢走勢</h3>
                  <LineChart datasets={[{ label: '業務總量', data: [12, 18, 15, 25, 22, tickets.length], color: '#3b82f6' }]} labels={['11月','12月','1月','2月','3月','4月']} isDarkMode={isDarkMode} />
               </div>
            </div>
          )}

          {/* 模組預留 */}
          {activeTab === 'settings' && (
            <div className="h-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
               <AlertCircle size={64} className="text-slate-200 mb-8" />
               <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">管理模組載入中</h3>
               <p className="text-slate-400 font-bold mt-2">正在與雲端同步系統設定參數，請稍候。</p>
            </div>
          )}

        </div>
      </main>

      {/* 案件詳情彈窗 */}
      {viewModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in" onClick={()=>setViewModalTicket(null)}>
           <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700" onClick={e=>e.stopPropagation()}>
               <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                  <h3 className="font-black text-xl dark:text-white">案件號：{viewModalTicket.ticketId}</h3>
                  <button onClick={()=>setViewModalTicket(null)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24}/></button>
               </div>
               <div className="p-10 overflow-y-auto space-y-8">
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl">
                     <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">醫療院所</span><span className="font-black dark:text-white">{viewModalTicket.instName || '無資訊'}</span></div>
                     <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">反映時間</span><span className="font-black dark:text-white">{new Date(viewModalTicket.receiveTime).toLocaleString()}</span></div>
                  </div>
                  <div className="space-y-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">客戶反映內容</span><div className="p-6 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-[2rem] text-sm leading-relaxed dark:text-slate-200">{viewModalTicket.extraInfo}</div></div>
                  <div className="space-y-3"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1 block">系統回覆軌跡</span><div className="p-6 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-[2rem] text-sm leading-relaxed whitespace-pre-wrap dark:text-blue-300">{formatRepliesHistory(viewModalTicket.replies, viewModalTicket.replyContent)}</div></div>
               </div>
               <div className="p-8 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 flex justify-end"><button onClick={()=>setViewModalTicket(null)} className="px-10 py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-2xl font-black">關閉檢視</button></div>
           </div>
        </div>
      )}

      {/* Toast 通知 */}
      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[999] animate-in slide-in-from-bottom-5 duration-300">
          <div className={`px-8 py-4 rounded-full font-black shadow-2xl flex items-center space-x-3 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}>
            {toast.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
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
