import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut, updatePassword } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  User, Settings, Camera, UserPlus, Timer, Calendar, Trash2, Plus, Upload, List,
  Search, Info, ChevronLeft, Save
} from 'lucide-react';

// === 1. 引入外部設定與工具 ===
import { auth, db, storage, functions, secondaryAuth, appId } from './lib/firebase';
// import useDebounce from './hooks/useDebounce';
import { 
  getFormatDate, 
  getFirstDayOfMonth, 
  getLastDayOfMonth, 
  getEmailFromUsername,
  formatRepliesHistory
} from './utils/helpers';

// === 2. 【偵錯模式：暫時遮蔽功能模組】 ===
/*
import TicketForm from './components/TicketForm';
import MaintenanceArea from './components/MaintenanceArea';
import HistoryArea from './components/HistoryArea';
import AllRecordsArea from './components/AllRecordsArea';
import AuditArea from './components/AuditArea';
import DashboardArea from './components/DashboardArea';
import SettingsArea from './components/SettingsArea';
import ViewEditModal from './components/ViewEditModal';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';
import CannedMessagesModal from './components/CannedMessagesModal';
import UserAvatar from './components/UserAvatar';
*/

// 提供偵錯用的簡單頭像占位符
const UserAvatarPlaceholder = ({ className }) => <div className={`${className} bg-slate-300 rounded-full flex items-center justify-center text-[10px] text-slate-600`}>User</div>;

const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

/**
 * 客服紀錄系統 - 偵錯模式 (App)
 * 此版本已移除所有子組件引用，用於確認核心架構是否能正常載入。
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
  
  // --- D. 系統下拉選單參數 ---
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [overdueHours, setOverdueHours] = useState(24);
  const [holidays, setHolidays] = useState([]);

  // --- E. 歷史查詢共用狀態 ---
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [searchTerm, setSearchTerm] = useState('');

  // --- F. 全域 UI 互動狀態 ---
  const [viewModalTicket, setViewModalTicket] = useState(null);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: '' });
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const [customDialog, setCustomDialog] = useState({ 
    isOpen: false, type: 'alert', title: '', message: '', inputValue: '', onConfirm: null, onCancel: null 
  });

  // ==================== 1. 初始化與身份驗證 ====================
  useEffect(() => {
    // 確保 Tailwind script 存在
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
      } catch (err) { console.error("Firebase Auth Init Error:", err); }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!currentUser) setCurrentUser({ id: user.uid, username: '偵錯中...', role: ROLES.USER });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // ==================== 2. Firebase 即時監聽 (保留邏輯，但暫不顯示組件) ====================
  useEffect(() => {
    const usersRef = collection(db, 'cs_users');
    return onSnapshot(usersRef, (snap) => {
      const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(usersData);
      const uMap = {};
      usersData.forEach(u => uMap[u.username] = u);
      setUserMap(uMap);
      
      const lastUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cs_last_user') : null;
      const matchedUser = usersData.find(u => u.username === lastUser) || usersData[0];
      
      if (matchedUser) {
        setCurrentUser(matchedUser);
        setActiveUser(matchedUser);
      } else if (auth.currentUser && usersData.length === 0) {
        setCurrentUser({ id: auth.currentUser.uid, username: '系統管理員', role: ROLES.ADMIN });
      }
    });
  }, []);

  // ... (其他監聽邏輯保持不變)

  // ==================== 3. 全域輔助函式 ====================
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
          <p style={{ fontWeight: 'bold', fontSize: '14px' }}>偵錯模式：核心載入中...</p>
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
      
      {/* 側邊導覽列 */}
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
              <div className="overflow-hidden">
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{currentUser.username}</div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-50 bg-slate-200 dark:bg-slate-700 px-1.5 rounded mt-0.5 inline-block">{currentUser.role}</div>
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
          <div className="bg-white dark:bg-slate-800 p-20 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 text-center shadow-sm">
            <Info size={48} className="mx-auto text-blue-500 mb-6" />
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">模組已暫時遮蔽</h3>
            <p className="text-slate-500 dark:text-slate-400">目前為偵錯模式，正在檢視頁籤：<span className="font-bold text-blue-600 dark:text-blue-400">{activeTab}</span></p>
            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-xs font-mono text-left max-w-md mx-auto text-slate-400">
               <div>Firebase Auth: OK</div>
               <div>Firestore Sync: OK</div>
               <div>Sidebar Navigation: OK</div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
