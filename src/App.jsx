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
  updateDoc 
} from 'firebase/firestore';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  Info, ChevronLeft, Save, ShieldAlert
} from 'lucide-react';

// =============================================================================
// 1. Firebase 初始化防禦邏輯 (防止模組層級崩潰)
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
      // 檢查是否為字串，若是則解析
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
  } catch (e) {
    console.error("Firebase Config Parse Error:", e);
  }
  return fallbackConfig;
};

// 宣告全域實例，並使用 try-catch 包裹以防止 script 直接死掉
let firebaseApp, auth, db;
let globalInitError = null;

try {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(getSafeConfig());
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
} catch (e) {
  console.error("Firebase Global Init Failed:", e);
  globalInitError = e.message;
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==================== 整合工具函式 ====================
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
 * 確保在任何環境下都不會出現完全的「白屏」
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

  // ==================== 1. 初始化與身份驗證 ====================
  useEffect(() => {
    // 捕獲渲染期間的錯誤
    const handleError = (e) => setRuntimeError(e.message || "未知執行錯誤");
    window.addEventListener('error', handleError);

    // 強制補回 Tailwind CSS 腳本 (若 index.html 遺漏)
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
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        console.error("Auth Process Error:", err);
        setRuntimeError(`身份驗證初始化失敗: ${err.message}`);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!currentUser) {
          setCurrentUser({ id: user.uid, username: '正在取得權限...', role: ROLES.ADMIN });
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('error', handleError);
    };
  }, [runtimeError]);

  // ==================== 2. 資料監聽 ====================
  useEffect(() => {
    if (!currentUser || runtimeError) return;
    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'cs_users');
      return onSnapshot(usersRef, (snap) => {
        setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCurrentUser(prev => ({...prev, username: '偵錯用戶'}));
      }, (err) => {
        console.error("Firestore Listener Error:", err);
        if (err.code === 'permission-denied') {
          setRuntimeError("Firestore 權限拒絕：請檢查 appId 與安全性規則。");
        }
      });
    } catch (e) {
      setRuntimeError(`資料監聽崩潰: ${e.message}`);
    }
  }, [currentUser, runtimeError]);

  // ==================== 3. 主題控制 ====================
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  // ==================== 4. 渲染邏輯 (內聯樣式防禦) ====================
  
  // 核心檢查點：顯示致命錯誤訊息
  if (runtimeError) {
    return (
      <div style={{ padding: '40px', backgroundColor: '#fff1f2', color: '#be123c', fontFamily: 'system-ui, -apple-system, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <ShieldAlert size={64} style={{ marginBottom: '24px' }} />
        <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.025em' }}>系統啟動失敗</h1>
        <p style={{ marginTop: '16px', fontSize: '16px', maxWidth: '500px', lineHeight: '1.6', color: '#9f1239' }}>
          偵測到致命錯誤。這通常是因為 Firebase 配置衝突或資源載入被攔截。
        </p>
        <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '2px solid #fecdd3', fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace', maxWidth: '80%', wordBreak: 'break-all', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          {runtimeError}
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '32px', padding: '12px 32px', backgroundColor: '#be123c', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '900', fontSize: '15px', transition: 'all 0.2s' }}>
          重新整理頁面
        </button>
      </div>
    );
  }

  // 載入中狀態 (使用內聯樣式)
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
        <div style={{ textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontWeight: '900', fontSize: '16px', letterSpacing: '0.05em' }}>正在啟動防禦性架構...</p>
          <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.6 }}>如果看到此畫面，代表腳本已成功執行。</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'new', label: '新增紀錄', icon: FileText },
    { id: 'maintain', label: '紀錄維護', icon: Wrench },
    { id: 'list', label: '歷史查詢', icon: History }
  ];

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽列 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <h1 className={`font-black text-white tracking-widest flex items-center ${sidebarOpen ? 'text-xl' : 'text-xs'}`}>
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "防禦模式"}
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
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{TABS.find(t => t.id === activeTab)?.label}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="bg-white dark:bg-slate-800 p-16 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm max-w-2xl mx-auto mt-12 animate-in zoom-in-95 duration-500">
            <CheckCircle size={56} className="mx-auto text-emerald-500 mb-6" />
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">腳本載入成功</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
              我們已成功進入 React 渲染週期。目前的白屏偵測顯示，基礎連線與環境配置已排除致命衝突。
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs text-left border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 mb-1">Firebase App</div>
                <div className="font-bold text-blue-500">已連線</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs text-left border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 mb-1">Firestore</div>
                <div className="font-bold text-emerald-500">讀取中 ({dbUsers.length})</div>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
