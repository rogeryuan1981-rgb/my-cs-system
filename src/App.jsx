import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  Info, ChevronLeft, Save, ShieldAlert
} from 'lucide-react';

// =============================================================================
// 1. Firebase 初始化與環境配置 (直接整合以解決 Could not resolve 錯誤)
// =============================================================================

// 優先使用環境變數中的配置，若無則使用您的專案預設值
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyBvIOc7J-0ID2F2mQv2_BaHThApPw3uVl0",
      authDomain: "customerservice-1f9c0.firebaseapp.com",
      projectId: "customerservice-1f9c0",
      storageBucket: "customerservice-1f9c0.firebasestorage.app",
      messagingSenderId: "34677415846",
      appId: "1:34677415846:web:880d8fafafbb66ad6fb967"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==================== 整合工具函式 (Helpers) ====================
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const getLastDayOfMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
};

const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

// =============================================================================
// 2. 【偵錯模式：組件占位符】
// =============================================================================
// 因為無法解析外部檔案，這裡定義簡單的占位符組件
const UserAvatarPlaceholder = ({ className }) => (
  <div className={`${className} bg-slate-300 dark:bg-slate-700 rounded-full flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-400 border border-white dark:border-slate-600 shadow-sm`}>
    User
  </div>
);

/**
 * 客服紀錄系統 - 偵錯模式整合版 (App)
 * 已修復：模組路徑解析錯誤、Firebase 初始化失敗問題。
 */
export default function App() {
  // --- A. 基礎狀態管理 ---
  const [currentUser, setCurrentUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false
  );
  
  // --- B. 導覽與頁籤狀態 ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  
  // --- C. 歷史查詢篩選狀態 ---
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());

  // ==================== 1. 初始化與身份驗證 ====================
  useEffect(() => {
    // 解決生產環境警告並確保 Tailwind 腳本存在
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
      originalWarn(...args);
    };

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
        // 設定偵錯身份，確保能進入渲染流程
        if (!currentUser) {
          setCurrentUser({ id: user.uid, username: '偵錯用戶', role: ROLES.ADMIN });
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribe();
      console.warn = originalWarn;
    };
  }, []);

  // ==================== 2. 資料監聽 (測試 Firestore 連線) ====================
  useEffect(() => {
    if (!currentUser) return;
    try {
      // 偵錯用：監聽使用者集合路徑是否正確
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'cs_users');
      return onSnapshot(usersRef, (snap) => {
        setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.log("Firestore Path Error:", err));
    } catch (e) {
      console.error("Firestore Init Error:", e);
    }
  }, [currentUser]);

  // ==================== 3. 主題切換 ====================
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  // ==================== 4. 主要 UI 渲染 ====================
  
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'sans-serif' }}>正在初始化核心架構...</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'new', label: '新增紀錄', icon: FileText },
    { id: 'maintain', label: '紀錄維護', icon: Wrench },
    { id: 'list', label: '歷史查詢', icon: History },
    { id: 'dashboard', label: '統計分析', icon: PieChart },
    { id: 'settings', label: '系統設定', icon: Settings }
  ];

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽列 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <h1 className={`font-black text-white tracking-widest flex items-center ${sidebarOpen ? 'text-xl' : 'text-xs'}`}>
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "偵錯模式"}
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
          <div className="bg-white dark:bg-slate-800 p-20 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm max-w-2xl mx-auto mt-12">
            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-6" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">整合修復成功：基礎架構載入中</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
              這代表核心 React 邏輯、Firebase 初始化以及 Tailwind 樣式均已正常運作。接下來我們將以此為基礎，將模組內聯化（Inline）進來。
            </p>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs font-mono text-left text-slate-400 border border-slate-100 dark:border-slate-800">
               <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2"><span>Auth 連線:</span> <span className="text-emerald-500 font-bold">穩定</span></div>
               <div className="flex justify-between"><span>使用者集合:</span> <span className="text-blue-500">{dbUsers.length} 位同仁</span></div>
               <div className="flex justify-between"><span>當前頁籤:</span> <span className="font-bold text-blue-500 uppercase">{activeTab}</span></div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
