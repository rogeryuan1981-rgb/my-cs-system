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

/**
 * =============================================================================
 * 1. 核心安全初始化 (防止任何導致白屏的模組級錯誤)
 * =============================================================================
 */

// 安全解析環境變數
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
      // 如果已經是物件就直接回傳，是字串才 parse
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
  } catch (e) { console.error("Env Config Parse Error", e); }
  return fallback;
};

// 全域實例宣告（使用防衝突命名）
let _app, _auth, _db;
let _initError = null;

try {
  // 防止重複初始化導致的 Crash
  _app = getApps().length > 0 ? getApp() : initializeApp(getSafeEnvConfig());
  _auth = getAuth(_app);
  _db = getFirestore(_app);
} catch (e) {
  _initError = e.message;
  console.error("Firebase Initialization Failed", e);
}

const _appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * =============================================================================
 * 2. 輔助工具 (直接內建以防止路徑引用錯誤)
 * =============================================================================
 */
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
 * =============================================================================
 * 3. 主應用程式組件
 * =============================================================================
 */
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [runtimeError, setRuntimeError] = useState(_initError);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false
  );
  
  const [activeTab, setActiveTab] = useState('new');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ---------------------------------------------------------------------------
  // 監測渲染錯誤與初始化環境
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 捕獲所有未處理的 JS 錯誤並顯示在 UI，防止白屏
    const handleError = (e) => setRuntimeError(e.message || "發生不明執行錯誤");
    window.addEventListener('error', handleError);

    // 強制遮蔽 Tailwind CDN 警告，並確保腳本存在
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

    const startAuth = async () => {
      if (runtimeError || !_auth) return;
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(_auth, __initial_auth_token);
        } else {
          await signInAnonymously(_auth);
        }
      } catch (err) {
        setRuntimeError(`身份驗證連線失敗: ${err.message}`);
      }
    };
    startAuth();

    const unsubAuth = onAuthStateChanged(_auth, (user) => {
      if (user) {
        if (!currentUser) setCurrentUser({ id: user.uid, username: '正在核對...', role: ROLES.ADMIN });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      window.removeEventListener('error', handleError);
      unsubAuth();
      console.warn = originalWarn;
    };
  }, [runtimeError]);

  // ---------------------------------------------------------------------------
  // 資料監聽 (測試資料庫連線)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser || runtimeError || !_db) return;
    try {
      const usersRef = collection(_db, 'artifacts', _appId, 'public', 'data', 'cs_users');
      return onSnapshot(usersRef, (snap) => {
        setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCurrentUser(prev => ({ ...prev, username: '系統檢測員' }));
      }, (err) => {
        if (err.code === 'permission-denied') {
          setRuntimeError("Firestore 權限拒絕：請確認資料庫規則已開啟。");
        }
      });
    } catch (e) { setRuntimeError(`資料讀取發生異常: ${e.message}`); }
  }, [currentUser, runtimeError]);

  // ---------------------------------------------------------------------------
  // 介面渲染
  // ---------------------------------------------------------------------------
  
  // A. 致命錯誤畫面 (內聯樣式防禦)
  if (runtimeError) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff1f2', color: '#be123c', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center' }}>
        <ShieldAlert size={64} style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: '900' }}>偵測到啟動故障</h1>
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #fecdd3', fontSize: '13px', maxWidth: '600px', wordBreak: 'break-all', fontFamily: 'monospace' }}>
          {runtimeError}
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '25px', padding: '12px 25px', backgroundColor: '#be123c', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>重新嘗試載入</button>
      </div>
    );
  }

  // B. 初始化中畫面 (內聯樣式防禦)
  if (!currentUser) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontWeight: 'bold' }}>正在啟動防禦性系統架構...</p>
        </div>
      </div>
    );
  }

  // C. 正常介面 (Tailwind)
  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <h1 className={`font-black text-white tracking-widest flex items-center ${sidebarOpen ? 'text-xl' : 'text-xs'}`}>
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "檢修模式"}
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
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0 text-center">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 text-slate-400 hover:text-yellow-500 transition-colors">{isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}</button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 relative">
        <header className="h-20 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200 dark:border-slate-700">
           <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">環境與連線穩定度檢測</h2>
           <button onClick={() => signOut(_auth).then(()=>window.location.reload())} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><LogOut size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="bg-white dark:bg-slate-800 p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm max-w-2xl mx-auto mt-12 animate-in zoom-in-95 duration-500">
            <CheckCircle size={56} className="mx-auto text-emerald-500 mb-6" />
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">整合腳本執行成功</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
              我們已修正了環境變數解析與 Firebase 初始化衝突的問題。如果您能看到這個畫面，代表 React 已經成功控制了渲染週期。
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs text-left border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 mb-1">連線狀態</div>
                <div className="font-bold text-blue-500">Firebase 已就緒</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs text-left border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 mb-1">當前用戶</div>
                <div className="font-bold text-emerald-500">{currentUser.username}</div>
              </div>
            </div>
            <p className="mt-8 text-[11px] text-slate-400 italic">如果確認沒問題，我將在下個步驟恢復所有功能組件。</p>
          </div>
        </div>
      </main>

    </div>
  );
}
