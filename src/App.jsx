import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut, updatePassword } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  User, Settings, Camera, UserPlus, Timer, Calendar, Trash2, Plus, Upload, List,
  Search, Info, ChevronLeft, Save
} from 'lucide-react';

// =============================================================================
// 1. 環境配置與初始化 (直接整合，解決 Could not resolve 錯誤)
// =============================================================================

// 取得環境變數中的 Firebase 配置
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { /* 預防性的後備配置，實際執行時會由環境注入 */ };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==================== 整合工具函式 (Helpers) ====================
const getFormatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const getLastDayOfMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
};

const getEmailFromUsername = (username) => `${username}@internal.system`;

const formatRepliesHistory = (replies, replyContent) => {
  if (replies && replies.length > 0) {
    return replies.map(r => `[${r.user}]: ${r.content}`).join('\n');
  }
  return replyContent || '';
};

// =============================================================================
// 2. 【偵錯模式：功能模組仍保持遮蔽】
// =============================================================================
/*
// 暫不使用 import，因為環境無法正確解析跨檔案模組
import TicketForm from './components/TicketForm';
import MaintenanceArea from './components/MaintenanceArea';
...
*/

// 提供偵錯用的簡單頭像占位符
const UserAvatarPlaceholder = ({ className }) => (
  <div className={`${className} bg-slate-300 dark:bg-slate-700 rounded-full flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-400 border border-white dark:border-slate-600 shadow-sm`}>
    User
  </div>
);

const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

/**
 * 客服紀錄系統 - 偵錯模式 (App)
 * 此版本已整合核心邏輯，並移除外部路徑依賴，用於確認基礎架構是否能渲染。
 */
export default function App() {
  // --- A. 基礎狀態管理 ---
  const [currentUser, setCurrentUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false
  );
  
  // --- B. 導覽與頁籤狀態 ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  
  // --- C. 系統核心數據 ---
  const [tickets, setTickets] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  
  // --- D. 系統下拉選單與歷史狀態 ---
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [searchTerm, setSearchTerm] = useState('');

  // --- E. 全域 UI 狀態 ---
  const [toast, setToast] = useState({ show: false, msg: '', type: '' });
  const [customDialog, setCustomDialog] = useState({ 
    isOpen: false, type: 'alert', title: '', message: '', inputValue: '', onConfirm: null, onCancel: null 
  });

  // ==================== 1. 初始化與身份驗證 ====================
  useEffect(() => {
    // 確保 Tailwind script 存在以支撐樣式
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        console.error("Firebase Auth Error:", err); 
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 先給予「偵錯中」身份防止渲染中斷，用於確認畫面是否能正常顯示
        if (!currentUser) setCurrentUser({ id: user.uid, username: '偵錯管理員', role: ROLES.ADMIN });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // ==================== 2. 資料監聽 (維持背景運作以利偵錯) ====================
  useEffect(() => {
    if (!currentUser) return;
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'cs_users');
    return onSnapshot(usersRef, (snap) => {
      const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(usersData);
      const uMap = {};
      usersData.forEach(u => uMap[u.username] = u);
      setUserMap(uMap);
    }, (err) => console.log("Users Snapshot Error:", err));
  }, [currentUser]);

  // ==================== 3. 主題切換 ====================
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('cs_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  // ==================== 4. 主要 UI 渲染 ====================
  
  // 檢查點 1: 是否卡在 currentUser 為空的 Loading 畫面？
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'sans-serif' }}>偵錯：正在初始化核心服務...</p>
          <p style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7 }}>若長時間卡在此畫面，請檢查控制台 (F12) 是否有 Firebase 配置錯誤。</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'new', label: '新增紀錄', icon: FileText, roles: [ROLES.ADMIN, ROLES.USER] },
    { id: 'maintain', label: '紀錄維護', icon: Wrench, roles: [ROLES.ADMIN, ROLES.USER] },
    { id: 'list', label: '歷史查詢', icon: History, roles: [ROLES.ADMIN, ROLES.USER, ROLES.VIEWER] },
    { id: 'all_records', label: '紀錄資料區', icon: Database, roles: [ROLES.ADMIN] },
    { id: 'audit', label: '申請與日誌區', icon: Shield, roles: [ROLES.ADMIN] },
    { id: 'dashboard', label: '進階統計', icon: PieChart, roles: [ROLES.ADMIN, ROLES.USER, ROLES.VIEWER] },
    { id: 'settings', label: '系統設定', icon: Settings, roles: [ROLES.ADMIN, ROLES.USER, ROLES.VIEWER] }
  ];

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽列 (確認側邊欄是否能渲染) */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <h1 className={`font-black text-white tracking-widest flex items-center ${sidebarOpen ? 'text-xl' : 'text-xs'}`}>
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "偵錯模式"}
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 space-y-2 px-3">
          {TABS.filter(tab => tab.roles.includes(currentUser.role)).map(tab => {
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
              <div className="flex items-center">
                <UserAvatarPlaceholder className="w-8 h-8 mr-2" />
                <div className="overflow-hidden">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{currentUser.username}</div>
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{currentUser.role}</div>
                </div>
              </div>
            )}
            <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* 主內容區 (確認主要框架是否能渲染) */}
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
          {/* 檢查點 2: 基礎 UI 是否能正常顯示？ */}
          <div className="bg-white dark:bg-slate-800 p-20 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm max-w-2xl mx-auto mt-12">
            <Info size={48} className="mx-auto text-blue-500 mb-6" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">核心架構載入成功</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
              這代表 `App.jsx` 的核心架構與 `lib/firebase` 的連線是正常的。目前我們故意屏蔽了所有子組件，以確認是否有特定的組件導致白屏。
            </p>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs font-mono text-left text-slate-400 border border-slate-100 dark:border-slate-800">
               <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2"><span>系統時間:</span> <span>{new Date().toLocaleString()}</span></div>
               <div className="flex justify-between"><span>當前頁籤:</span> <span className="font-bold text-blue-500 uppercase">{activeTab}</span></div>
               <div className="flex justify-between"><span>Auth 狀態:</span> <span className="text-emerald-500">已連線 ({currentUser.username})</span></div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
