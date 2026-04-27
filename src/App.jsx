import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Menu, X, LogOut, Sun, Moon, Bell, Database, PieChart, Shield, History, Wrench, FileText, CheckCircle } from 'lucide-react';

// === 嚴格遵守模組化，純粹透過 import 引入外部依賴 ===
// (請確保您的本地端 src/lib/ 以及 src/components/ 資料夾下已確實建立對應的檔案)
import { auth, db, storage, functions, secondaryAuth } from './lib/firebase';

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

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 側邊欄與分頁狀態
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  
  // 系統資料狀態
  const [tickets, setTickets] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  
  // 系統設定下拉選單狀態
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [overdueHours, setOverdueHours] = useState(24);
  const [holidays, setHolidays] = useState([]);

  // 全局彈窗狀態
  const [viewModalTicket, setViewModalTicket] = useState(null);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: '' });
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [isImportingHistory, setIsImportingHistory] = useState(false);

  // 自訂彈窗狀態 (取代瀏覽器原生的 alert/confirm/prompt)
  const [customDialog, setCustomDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', inputValue: '', onConfirm: null, onCancel: null });

  // 取得全域 appId
  const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];

  // ==================== 初始化與資料監聽 ====================
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = user.uid.substring(0, 8);
        const nameFallback = `用戶_${uid}`;
        setCurrentUser({ id: user.uid, username: nameFallback, role: ROLES.USER });
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const usersRef = baseDbPath.length ? collection(db, ...baseDbPath, 'cs_users') : collection(db, 'cs_users');
    return onSnapshot(usersRef, (snap) => {
      const usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbUsers(usersData);
      
      const uMap = {};
      usersData.forEach(u => uMap[u.username] = u);
      setUserMap(uMap);
      
      const matchedUser = usersData.find(u => u.username === currentUser.username) || usersData[0];
      if (matchedUser) {
        setCurrentUser(matchedUser);
        setActiveUser(matchedUser);
      }
    });
  }, [currentUser?.id]); // 僅在 user ID 變更時重新綁定監聽

  useEffect(() => {
    const settingsRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
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
    const recordsRef = baseDbPath.length ? collection(db, ...baseDbPath, 'cs_records') : collection(db, 'cs_records');
    return onSnapshot(recordsRef, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.receiveTime) - new Date(a.receiveTime)));
    });
  }, []);

  useEffect(() => {
    const instRef = baseDbPath.length ? collection(db, ...baseDbPath, 'mohw_institutions') : collection(db, 'mohw_institutions');
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

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // ==================== 全域輔助函式 ====================
  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3000);
  };

  const customAlert = (msg) => new Promise(resolve => setCustomDialog({ isOpen: true, type: 'alert', title: '提示', message: msg, onConfirm: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(); } }));
  const customConfirm = (msg) => new Promise(resolve => setCustomDialog({ isOpen: true, type: 'confirm', title: '確認', message: msg, onConfirm: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(true); }, onCancel: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(false); } }));
  const customPrompt = (msg) => new Promise(resolve => setCustomDialog({ isOpen: true, type: 'prompt', title: '請輸入', message: msg, inputValue: '', onConfirm: (val) => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(val); }, onCancel: () => { setCustomDialog(prev => ({...prev, isOpen: false})); resolve(null); } }));

  const handleLogout = async () => {
    if (await customConfirm("確定要登出系統嗎？")) {
      await signOut(auth);
      window.location.reload();
    }
  };

  // 匯出/匯入/批次操作函式 (傳遞給 HistoryArea 與 AllRecordsArea)
  const handleBatchDeleteTickets = async (ids) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!(await customConfirm(`確定要標記這 ${ids.length} 筆案件為「已刪除」嗎？`))) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        const ref = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', id) : doc(db, 'cs_records', id);
        batch.update(ref, { isDeleted: true });
      });
      await batch.commit();
      showToast(`成功將 ${ids.length} 筆案件標記為刪除！`, 'success');
      setSelectedTickets([]);
    } catch (e) { showToast("刪除失敗：" + e.message, "error"); }
  };

  const handleBatchHardDeleteTickets = async (ids) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!(await customConfirm(`警告：確定要徹底抹除這 ${ids.length} 筆案件嗎？此操作無法還原！`))) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        const ref = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', id) : doc(db, 'cs_records', id);
        batch.delete(ref);
      });
      await batch.commit();
      showToast(`成功徹底抹除 ${ids.length} 筆案件！`, 'success');
      setSelectedTickets([]);
    } catch (e) { showToast("抹除失敗：" + e.message, "error"); }
  };

  const handleApproveDelete = async (ticketId, instName) => {
    if (!(await customConfirm(`確定要核准刪除案件「${instName}」嗎？`))) return;
    try {
      const ref = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', ticketId) : doc(db, 'cs_records', ticketId);
      await updateDoc(ref, { isDeleted: true, deleteRequest: { status: 'approved', approvedBy: currentUser.username, time: new Date().toISOString() } });
      showToast('已核准刪除', 'success');
    } catch (e) { showToast('核准失敗：' + e.message, 'error'); }
  };

  const handleRejectDelete = async (ticketId) => {
    if (!(await customConfirm(`確定要退回此刪除申請嗎？`))) return;
    try {
      const ref = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', ticketId) : doc(db, 'cs_records', ticketId);
      await updateDoc(ref, { 'deleteRequest.status': 'rejected', 'deleteRequest.rejectedBy': currentUser.username, 'deleteRequest.time': new Date().toISOString() });
      showToast('已退回申請', 'success');
    } catch (e) { showToast('退回失敗：' + e.message, 'error'); }
  };

  const handleExportExcel = (dataList) => {
    if (!window.XLSX) return showToast("Excel 模組尚未載入完成", "error");
    const exportData = dataList.map(t => ({
      '案件號碼': t.ticketId, '接收時間': t.receiveTime, '建檔人員': t.receiver, '負責人員': t.assignee || '',
      '反映管道': t.channel, '醫療院所代碼': t.instCode, '醫療院所名稱': t.instName, '提問人': t.questioner,
      '類別': t.category, '狀態': t.status, '進度': t.progress, '結案時間': t.closeTime || '',
      '問題描述': t.extraInfo, '回覆紀錄摘要': (t.replies && t.replies.length > 0) ? t.replies.map(r => `${r.user}: ${r.content}`).join('\n') : (t.replyContent || ''),
      '狀態(邏輯刪除)': t.isDeleted ? '已刪除' : '正常'
    }));
    const worksheet = window.XLSX.utils.json_to_sheet(exportData);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "案件紀錄");
    window.XLSX.writeFile(workbook, `案件紀錄匯出_${new Date().getTime()}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    if (!window.XLSX) return showToast("Excel 模組尚未載入完成", "error");
    const templateData = [{
      '案件號碼(選填)': '2024010100001', '接收時間(YYYY-MM-DDTHH:mm)': '2024-01-01T10:00', '建檔人員': '王小明', '負責人員(選填)': '李小華',
      '反映管道': '電話', '醫療院所代碼(10碼或999)': '1234567890', '醫療院所名稱(選填)': '測試診所', '提問人(選填)': '陳先生',
      '類別': '系統操作', '狀態': '一般', '進度(待處理/處理中/結案)': '待處理', '結案時間(選填)': '',
      '問題描述': '無法登入系統', '歷史回覆內容(選填)': '已協助重置密碼'
    }];
    const worksheet = window.XLSX.utils.json_to_sheet(templateData);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "匯入範本");
    window.XLSX.writeFile(workbook, "案件紀錄_匯入範本.xlsx");
  };

  const handleImportHistoryExcel = async (e) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    const file = e.target.files[0];
    if (!file || !window.XLSX) return showToast("請確認檔案格式或 Excel 模組是否載入", "error");
    
    setIsImportingHistory(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const batch = writeBatch(db);
        let count = 0;
        
        jsonData.forEach(row => {
          if (!row['建檔人員'] || !row['反映管道'] || !row['類別'] || !row['進度']) return;
          
          const newDocRef = baseDbPath.length ? doc(collection(db, ...baseDbPath, 'cs_records')) : doc(collection(db, 'cs_records'));
          const record = {
            ticketId: row['案件號碼(選填)'] ? String(row['案件號碼(選填)']) : `IMP${new Date().getTime()}${Math.floor(Math.random()*1000)}`,
            receiveTime: row['接收時間(YYYY-MM-DDTHH:mm)'] || new Date().toISOString().slice(0, 16),
            receiver: row['建檔人員'],
            assignee: row['負責人員(選填)'] || '',
            channel: row['反映管道'],
            instCode: row['醫療院所代碼(10碼或999)'] ? String(row['醫療院所代碼(10碼或999)']).padStart(10, '0') : '999',
            instName: row['醫療院所名稱(選填)'] || '',
            questioner: row['提問人(選填)'] || '',
            category: row['類別'],
            status: row['狀態'] || '一般',
            progress: row['進度(待處理/處理中/結案)'] || '待處理',
            closeTime: row['結案時間(選填)'] || '',
            extraInfo: row['問題描述'] || '',
            replyContent: row['歷史回覆內容(選填)'] || '',
            replies: [], editLogs: [], isDeleted: false, createdAt: new Date().toISOString()
          };
          
          batch.set(newDocRef, record);
          count++;
        });
        
        if (count > 0) {
          await batch.commit();
          showToast(`成功匯入 ${count} 筆案件！`, 'success');
        } else {
          showToast(`未找到有效資料，請確認欄位名稱。`, 'error');
        }
      } catch (error) { showToast('匯入失敗：' + error.message, 'error'); } 
      finally { setIsImportingHistory(false); e.target.value = null; }
    };
    reader.readAsArrayBuffer(file);
  };

  // ==================== 渲染介面 ====================
  if (!currentUser) {
    return <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-900"><div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>;
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

  const pendingDeleteCount = tickets.filter(t => !t.isDeleted && t.deleteRequest && t.deleteRequest.status === 'pending').length;

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導航列 */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 shadow-2xl transition-all duration-300 z-30 flex flex-col shrink-0 border-r border-slate-100 dark:border-slate-700`}>
        <div className="h-20 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 bg-blue-600 dark:bg-blue-900 shrink-0 relative overflow-hidden group cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          {sidebarOpen ? <h1 className="text-xl font-black text-white tracking-widest relative z-10 flex items-center"><Shield size={22} className="mr-2"/> 客服管理系統</h1> : <Shield size={24} className="text-white relative z-10"/>}
        </div>
        <nav className="flex-1 overflow-y-auto py-6 space-y-2 px-3">
          {TABS.filter(tab => tab.roles.includes(currentUser.role)).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === 'audit' && pendingDeleteCount > 0 && sidebarOpen;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center p-3.5 rounded-2xl transition-all group relative ${isActive ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-black shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200 font-bold'}`}>
                <Icon size={20} className={`${sidebarOpen ? 'mr-4' : 'mx-auto'} transition-transform group-hover:scale-110 ${isActive ? 'drop-shadow-sm' : ''}`} />
                {sidebarOpen && <span className="tracking-wide">{tab.label}</span>}
                {showBadge && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-sm">{pendingDeleteCount}</span>}
                {!sidebarOpen && showBadge && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center flex-col space-y-4'}`}>
            <div className={`flex items-center ${!sidebarOpen && 'hidden'}`}>
              <UserAvatar username={activeUser?.username} photoURL={activeUser?.photoURL} className="w-9 h-9 text-xs shadow-sm mr-3" />
              <div className="overflow-hidden">
                <div className="text-sm font-black text-slate-800 dark:text-slate-200 truncate">{currentUser.username}</div>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 rounded inline-block mt-0.5">{currentUser.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 rounded-xl transition-all" title="登出系統"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 relative">
        <header className="h-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors hidden md:block"><Menu size={20} /></button>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-wide hidden sm:block">{TABS.find(t => t.id === activeTab)?.label}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          
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
              handleBatchDeleteTickets={handleBatchDeleteTickets} handleExportExcel={handleExportExcel} 
              handleImportHistoryExcel={handleImportHistoryExcel} isImportingHistory={isImportingHistory} 
              handleDownloadTemplate={handleDownloadTemplate}
            />
          )}

          {activeTab === 'all_records' && (
            <AllRecordsArea 
              currentUser={currentUser} ROLES={ROLES} tickets={tickets} categoryMapping={categoryMapping} 
              userMap={userMap} selectedTickets={selectedTickets} setSelectedTickets={setSelectedTickets} 
              setViewModalTicket={setViewModalTicket} handleBatchDeleteTickets={handleBatchDeleteTickets} 
              handleBatchHardDeleteTickets={handleBatchHardDeleteTickets} handleExportExcel={handleExportExcel}
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
              ROLES={ROLES} isDarkMode={isDarkMode} setHistoryStartDate={()=>{}} setHistoryEndDate={()=>{}} 
              setHistoryProgress={()=>{}} setSearchTerm={()=>{}} setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsArea 
              currentUser={currentUser} activeUser={activeUser} dbUsers={dbUsers} userMap={userMap} 
              channels={channels} categories={categories} statuses={statuses} progresses={progresses} 
              cannedMessages={cannedMessages} categoryMapping={categoryMapping} overdueHours={overdueHours} 
              holidays={holidays} institutions={institutions} instMap={instMap} auth={auth} db={db} 
              storage={storage} functions={functions} secondaryAuth={secondaryAuth} appId={currentAppId} 
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

      {/* 全域 Toast 通知 */}
      {toast.show && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-6 py-3 rounded-full font-bold shadow-lg flex items-center space-x-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'}`}>
            {toast.type === 'error' ? <X size={16} /> : <CheckCircle size={16} className={toast.type === 'success' ? 'text-green-400 dark:text-green-600' : ''}/>}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* 自訂 Dialog (取代原生的 alert/confirm/prompt) */}
      {customDialog.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col">
            <h3 className="font-black text-lg mb-2 text-slate-800 dark:text-slate-100">{customDialog.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 whitespace-pre-wrap">{customDialog.message}</p>
            {customDialog.type === 'prompt' && (
              <input type="text" autoFocus value={customDialog.inputValue} onChange={e => setCustomDialog({...customDialog, inputValue: e.target.value})} className="w-full p-3 mb-6 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"/>
            )}
            <div className="flex justify-end space-x-3 mt-auto">
              {customDialog.type !== 'alert' && (
                <button onClick={customDialog.onCancel} className="px-4 py-2 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">取消</button>
              )}
              <button onClick={() => customDialog.onConfirm(customDialog.inputValue)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md">確認</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
