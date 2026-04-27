import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, Wrench, FileText, CheckCircle } from 'lucide-react';

// === 1. 引入外部設定與工具 ===
import { auth, db, storage, functions, secondaryAuth, appId } from './lib/firebase';
import { 
  getFirstDayOfMonth, 
  getLastDayOfMonth, 
  getEmailFromUsername 
} from './utils/helpers';

// === 2. 引入拆分後的 UI 模組 ===
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

const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

/**
 * 客服紀錄系統 - 終極重構主進入點 (App)
 * 負責全局狀態管理、Firebase 監聽以及各個功能模組的調度
 */
export default function App() {
  // --- 基礎狀態 ---
  const [currentUser, setCurrentUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false
  );
  
  // --- UI 導覽狀態 ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  
  // --- 系統資料狀態 ---
  const [tickets, setTickets] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  
  // --- 系統下拉選單與參數狀態 ---
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [overdueHours, setOverdueHours] = useState(24);
  const [holidays, setHolidays] = useState([]);

  // --- 歷史查詢區狀態連動 (用於 Dashboard 跳轉與全域搜尋) ---
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [searchTerm, setSearchTerm] = useState('');

  // --- 全局彈窗與提示狀態 ---
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
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Init Error:", err); }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) { setCurrentUser(null); setActiveUser(null); }
    });
    return () => unsubscribe();
  }, []);

  // ==================== 2. 資料即時監聽 (Real-time Sync) ====================
  useEffect(() => {
    const usersRef = collection(db, 'cs_users');
    return onSnapshot(usersRef, (snap) => {
      const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(usersData);
      const uMap = {};
      usersData.forEach(u => uMap[u.username] = u);
      setUserMap(uMap);
      
      const matchedUser = usersData.find(u => u.username === (typeof localStorage !== 'undefined' ? localStorage.getItem('cs_last_user') : null)) || usersData[0];
      if (matchedUser) { setCurrentUser(matchedUser); setActiveUser(matchedUser); }
    });
  }, []);

  useEffect(() => {
    const settingsRef = doc(db, 'cs_settings', 'dropdowns');
    return onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChannels(data.channels || []);
        setCategories(data.categories || []);
        setStatuses(data.statuses || []);
        setProgresses(data.progresses || []);
        setCannedMessages(data.cannedMessages || []);
        setCategoryMapping(data.categoryMapping || {});
        setOverdueHours(data.overdueHours || 24);
        setHolidays(data.holidays || []);
      }
    });
  }, []);

  useEffect(() => {
    const recordsRef = collection(db, 'cs_records');
    return onSnapshot(recordsRef, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.receiveTime) - new Date(a.receiveTime)));
    });
  }, []);

  useEffect(() => {
    const instRef = collection(db, 'mohw_institutions');
    return onSnapshot(instRef, (snap) => {
      let allInsts = [];
      let currentMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.isChunk && data.payload) {
          try {
            const parsed = JSON.parse(data.payload);
            allInsts = allInsts.concat(parsed);
            parsed.forEach(i => currentMap[i.code] = i);
          } catch(e) {}
        } else {
          allInsts.push({ id: d.id, ...data });
          currentMap[data.code] = data;
        }
      });
      setInstitutions(allInsts);
      setInstMap(currentMap);
    });
  }, []);

  // ==================== 3. 全域輔助函式 ====================
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('cs_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3000);
  };

  const customAlert = (msg) => new Promise(resolve => setCustomDialog({ isOpen: true, type: 'alert', title: '系統提示', message: msg, onConfirm: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(); } }));
  const customConfirm = (msg) => new Promise(resolve => setCustomDialog({ isOpen: true, type: 'confirm', title: '確認操作', message: msg, onConfirm: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(true); }, onCancel: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(false); } }));
  const customPrompt = (msg) => new Promise(resolve => setCustomDialog({ isOpen: true, type: 'prompt', title: '請輸入內容', message: msg, inputValue: '', onConfirm: (val) => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(val); }, onCancel: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(null); } }));

  const handleLogout = async () => {
    if (await customConfirm("確定要登出系統嗎？")) {
      await signOut(auth);
      window.location.reload();
    }
  };

  // 批次操作邏輯
  const handleBatchDeleteTickets = async (ids) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!(await customConfirm(`確定要將這 ${ids.length} 筆案件標記為「已刪除」嗎？`))) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, 'cs_records', id), { isDeleted: true }));
      await batch.commit();
      showToast(`成功標記 ${ids.length} 筆案件！`, 'success');
      setSelectedTickets([]);
    } catch (e) { showToast("刪除失敗：" + e.message, "error"); }
  };

  const handleBatchHardDeleteTickets = async (ids) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!(await customConfirm(`警告：將徹底從資料庫抹除 ${ids.length} 筆案件，且不可還原！確定執行？`))) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, 'cs_records', id)));
      await batch.commit();
      showToast(`成功抹除 ${ids.length} 筆案件！`, 'success');
      setSelectedTickets([]);
    } catch (e) { showToast("抹除失敗：" + e.message, "error"); }
  };

  const handleApproveDelete = async (ticketId, instName) => {
    if (!(await customConfirm(`核准刪除「${instName}」的申請？`))) return;
    try {
      await updateDoc(doc(db, 'cs_records', ticketId), { isDeleted: true, 'deleteRequest.status': 'approved' });
      showToast('核准成功', 'success');
    } catch (e) { showToast('核准失敗：' + e.message, 'error'); }
  };

  const handleRejectDelete = async (ticketId) => {
    if (!(await customConfirm(`退回此筆刪除申請？`))) return;
    try {
      await updateDoc(doc(db, 'cs_records', ticketId), { 'deleteRequest.status': 'rejected' });
      showToast('已退回申請', 'success');
    } catch (e) { showToast('退回失敗：' + e.message, 'error'); }
  };

  // ==================== 4. 渲染邏輯 ====================
  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="text-slate-500 font-bold animate-pulse">系統載入中...</p>
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
            <Shield size={22} className={sidebarOpen ? "mr-2" : ""} /> {sidebarOpen && "客服紀錄系統"}
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
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          {activeTab === 'new' && (
            <TicketForm 
              currentUser={currentUser} channels={channels} categories={categories} statuses={statuses} 
              progresses={progresses} dbUsers={dbUsers} db={db} setShowCannedModal={setShowCannedModal} 
              showToast={showToast} instMap={instMap} tickets={tickets}
            />
          )}

          {activeTab === 'maintain' && (
            <MaintenanceArea 
              currentUser={currentUser} tickets={tickets} dbUsers={dbUsers} userMap={userMap} 
              progresses={progresses} overdueHours={overdueHours} db={db} showToast={showToast} 
              customPrompt={customPrompt} cannedMessages={cannedMessages}
            />
          )}

          {activeTab === 'list' && (
            <HistoryArea 
              currentUser={currentUser} ROLES={ROLES} tickets={tickets} progresses={progresses} 
              categoryMapping={categoryMapping} userMap={userMap} selectedTickets={selectedTickets} 
              setSelectedTickets={setSelectedTickets} setViewModalTicket={setViewModalTicket} 
              handleBatchDeleteTickets={handleBatchDeleteTickets} handleExportExcel={()=>{}} 
              handleImportHistoryExcel={()=>{}} isImportingHistory={false}
              historyStartDate={historyStartDate} setHistoryStartDate={setHistoryStartDate}
              historyEndDate={historyEndDate} setHistoryEndDate={setHistoryEndDate}
              historyProgress={historyProgress} setHistoryProgress={setHistoryProgress}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            />
          )}

          {activeTab === 'all_records' && (
            <AllRecordsArea 
              currentUser={currentUser} ROLES={ROLES} tickets={tickets} categoryMapping={categoryMapping} 
              userMap={userMap} selectedTickets={selectedTickets} setSelectedTickets={setSelectedTickets} 
              setViewModalTicket={setViewModalTicket} handleBatchDeleteTickets={handleBatchDeleteTickets} 
              handleBatchHardDeleteTickets={handleBatchHardDeleteTickets} handleExportExcel={()=>{}}
            />
          )}

          {activeTab === 'audit' && (
            <AuditArea 
              tickets={tickets} userMap={userMap} 
              handleRejectDelete={handleRejectDelete} handleApproveDelete={handleApproveDelete}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardArea 
              tickets={tickets} categories={categories} categoryMapping={categoryMapping} userMap={userMap} 
              ROLES={ROLES} isDarkMode={isDarkMode} 
              setHistoryStartDate={setHistoryStartDate} setHistoryEndDate={setHistoryEndDate} 
              setHistoryProgress={setHistoryProgress} setSearchTerm={setSearchTerm} 
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsArea 
              currentUser={currentUser} activeUser={activeUser} dbUsers={dbUsers} userMap={userMap} 
              channels={channels} categories={categories} statuses={statuses} progresses={progresses} 
              cannedMessages={cannedMessages} categoryMapping={categoryMapping} overdueHours={overdueHours} 
              holidays={holidays} institutions={institutions} instMap={instMap} auth={auth} db={db} 
              storage={storage} functions={functions} secondaryAuth={secondaryAuth} appId={appId} 
              ROLES={ROLES} showToast={showToast} customConfirm={customConfirm} customAlert={customAlert} customPrompt={customPrompt}
            />
          )}
          
        </div>
      </main>

      {/* 全域彈窗 */}
      {viewModalTicket && (
        <ViewEditModal 
          ticket={viewModalTicket} onClose={() => setViewModalTicket(null)} currentUser={currentUser} 
          ROLES={ROLES} userMap={userMap} channels={channels} categories={categories} statuses={statuses} 
          progresses={progresses} dbUsers={dbUsers} db={db} showToast={showToast}
        />
      )}

      {showCannedModal && (
        <CannedMessagesModal messages={cannedMessages} onClose={() => setShowCannedModal(false)} showToast={showToast} />
      )}

      {activeUser?.requirePasswordChange && (
        <ForcePasswordChangeModal activeUser={activeUser} showToast={showToast} auth={auth} db={db} />
      )}

      {/* 自訂對話框 */}
      {customDialog.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col border border-slate-200 dark:border-slate-700">
            <h3 className="font-black text-lg mb-2 text-slate-800 dark:text-slate-100">{customDialog.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{customDialog.message}</p>
            {customDialog.type === 'prompt' && (
              <input type="text" autoFocus value={customDialog.inputValue} onChange={e => setCustomDialog({...customDialog, inputValue: e.target.value})} className="w-full p-3 mb-6 bg-slate-50 dark:bg-slate-700 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"/>
            )}
            <div className="flex justify-end space-x-3">
              {customDialog.type !== 'alert' && (
                <button onClick={customDialog.onCancel} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">取消</button>
              )}
              <button onClick={() => customDialog.onConfirm(customDialog.inputValue)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">確認</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      {toast.show && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] animate-in slide-in-from-bottom-5 duration-300">
          <div className={`px-6 py-3 rounded-full font-bold shadow-lg flex items-center space-x-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

    </div>
  );
}
