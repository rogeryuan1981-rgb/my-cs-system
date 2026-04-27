import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
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
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  Info, ChevronLeft, Save, ShieldAlert
} from 'lucide-react';

// =============================================================================
// 1. Firebase 初始化防禦邏輯 (整合版 - 移除外部 import 以防止路徑錯誤)
// =============================================================================

const getSafeConfig = () => {
  const fallbackConfig = {
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
  } catch (e) {
    console.error("Firebase Config Parse Error:", e);
  }
  return fallbackConfig;
};

// 使用不同於 import 的名稱，防止 Identifier has already been declared 錯誤
let systemApp, systemAuth, systemDb;
let globalInitError = null;

try {
  systemApp = getApps().length > 0 ? getApp() : initializeApp(getSafeConfig());
  systemAuth = getAuth(systemApp);
  systemDb = getFirestore(systemApp);
} catch (e) {
  console.error("Firebase Global Init Failed:", e);
  globalInitError = e.message;
}

const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==================== 整合必要工具函式 (Helpers) ====================
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

/**
 * 客服紀錄系統 - 終極防護版
 * 此版本為完全獨立檔案，不依賴 src/lib/ 或 src/utils/，確保基礎架構能成功啟動。
 */
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [runtimeError, setRuntimeError] = useState(globalInitError);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false
  );
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());

  // ==================== 1. 初始化與認證 ====================
  useEffect(() => {
    // 捕獲渲染期間的錯誤並顯示在 UI 上，而非白屏
    const handleError = (e) => setRuntimeError(e.message || "未知執行錯誤");
    window.addEventListener('error', handleError);

    // 強制遮蔽 Tailwind 生產環境警告
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
      originalWarn(...args);
    };

    // 自動補回樣式腳本
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    const initAuth = async () => {
      if (runtimeError) return;
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(systemAuth, __initial_auth_token);
        } else {
          await signInAnonymously(systemAuth);
        }
      } catch (err) { 
        console.error("Auth Process Error:", err);
        setRuntimeError(`身份驗證初始化失敗: ${err.message}`);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(systemAuth, (user) => {
      if (user) {
        if (!currentUser) {
          setCurrentUser({ id: user.uid, username: '正在核對...', role: ROLES.ADMIN });
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('error', handleError);
      console.warn = originalWarn;
    };
  }, [runtimeError]);

  // ==================== 2. 資料監聽 (測試 Firestore 連線) ====================
  useEffect(() => {
    if (!currentUser || runtimeError) return;
    try {
      const usersRef = collection(systemDb, 'artifacts', currentAppId, 'public', 'data', 'cs_users');
      return onSnapshot(usersRef, (snap) => {
        setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCurrentUser(prev => ({...prev, username: '偵錯用戶'}));
      }, (err) => {
        console.error("Firestore Listener Error:", err);
        if (err.code === 'permission-denied') {
          setRuntimeError("Firestore 權限拒絕：請檢查 appId 與規則。");
        }
      });
    } catch (e) {
      setRuntimeError(`資料監聽崩潰: ${e.message}`);
    }
  }, [currentUser, runtimeError]);

  // ==================== 3. 主題切換 ====================
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleLogout = async () => {
    await signOut(systemAuth);
    window.location.reload();
  };

  // ==================== 4. 渲染邏輯 (內聯樣式防禦) ====================
  
  if (runtimeError) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#fff1f2', color: '#be123c', fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h1 style={{ fontSize: '28px', fontWeight: '900' }}>系統啟動失敗</h1>
        <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '2px solid #fecdd3', fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', maxWidth: '80%', wordBreak: 'break-all' }}>
          {runtimeError}
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '32px', padding: '12px 32px', backgroundColor: '#be123c', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '900' }}>
          重新整理頁面
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
        <div style={{ textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontWeight: '900', fontSize: '16px' }}>正在啟動整合型防禦架構...</p>
          <p style={{ fontSize: '11px', marginTop: '8px' }}>若持續白屏，請按 F12 檢查控制台錯誤。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽列 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <h1 className={`font-black text-white tracking-widest flex items-center ${sidebarOpen ? 'text-xl' : 'text-xs'}`}>
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "修復模式"}
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 space-y-2 px-3">
          {['new', 'maintain', 'list'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full flex items-center p-3.5 rounded-2xl transition-all group ${activeTab === id ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-black shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
              <div className={sidebarOpen ? "mr-4" : "mx-auto"}><Database size={20} /></div>
              {sidebarOpen && <span className="truncate">{id === 'new' ? '新增紀錄' : id === 'maintain' ? '紀錄維護' : '歷史查詢'}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{currentUser.username}</div>
                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-50 bg-slate-200 dark:bg-slate-700 px-1.5 rounded mt-0.5 inline-block">{currentUser.role}</div>
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
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hidden md:block transition-all hover:bg-blue-50 hover:text-blue-600"><Menu size={20} /></button>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">核心環境檢測</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="bg-white dark:bg-slate-800 p-16 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm max-w-2xl mx-auto mt-12 animate-in zoom-in-95 duration-500">
            <CheckCircle size={56} className="mx-auto text-emerald-500 mb-6" />
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">整合版腳本載入成功</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
              我們已移除所有外部檔案引用，並修正了變數重複宣告的問題。如果現在畫面不再是一片白，代表我們的診斷路徑是正確的。
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs text-left border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 mb-1">Firebase App</div>
                <div className="font-bold text-blue-500">已連線</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs text-left border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 mb-1">使用者同步</div>
                <div className="font-bold text-emerald-500">正常 ({dbUsers.length})</div>
              </div>
            </div>
            <p className="mt-8 text-[10px] text-slate-400 italic">請在回覆中告訴我您是否看到了這個畫面。</p>
          </div>
        </div>
      </main>

    </div>
  );
}
