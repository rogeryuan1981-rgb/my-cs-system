import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut, updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  Menu, X, LogOut, Sun, Moon, Database, PieChart, Shield, History, 
  Wrench, FileText, CheckCircle, AlertCircle, MessageCircle, ChevronRight,
  User, Settings, Camera, UserPlus, Timer, Calendar, Trash2, Plus, Upload, List,
  Search, Filter, Download, ArrowUpDown, ChevronLeft, Save, ShieldAlert, Edit, Info
} from 'lucide-react';

// =============================================================================
// 1. Firebase 初始化 (遵循單一檔案規範，整合所有配置)
// =============================================================================
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// =============================================================================
// 2. 輔助工具函式 (Helpers)
// =============================================================================
const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

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
    return replies.map(r => `[${r.user} @ ${r.time}] ${r.content}`).join('\n');
  }
  return replyContent || '(無紀錄)';
};

// =============================================================================
// 3. UI 基礎元件 (Sub-Components)
// =============================================================================

// 使用者頭像
const UserAvatar = ({ username, photoURL, className = "w-10 h-10 text-sm" }) => {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500'];
  const bgColor = colors[initial.charCodeAt(0) % colors.length] || 'bg-slate-400';

  if (photoURL) {
    return <img src={photoURL} alt={username} className={`${className} rounded-full object-cover shadow-sm border border-white dark:border-slate-700`} />;
  }
  return (
    <div className={`${className} ${bgColor} rounded-full flex items-center justify-center text-white font-black shadow-sm border border-white dark:border-slate-700`}>
      {initial}
    </div>
  );
};

// 分頁器
const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center space-x-2 py-6">
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><ChevronLeft size={20}/></button>
      <span className="text-sm font-black text-slate-500 mx-4">第 {currentPage} / {totalPages} 頁</span>
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"><ChevronRight size={20}/></button>
    </div>
  );
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

// =============================================================================
// 4. 功能頁面元件 (Business Components)
// =============================================================================

/**
 * 4.1 新增紀錄表單 (TicketForm)
 */
const TicketForm = ({ currentUser, channels, categories, statuses, progresses, dbUsers, setShowCannedModal, showToast, instMap, tickets }) => {
  const initialForm = {
    receiveTime: new Date().toISOString().slice(0, 16),
    receiver: currentUser?.username || '',
    channel: '',
    instCode: '',
    instName: '',
    questioner: '',
    category: '',
    status: '一般',
    progress: '待處理',
    extraInfo: '',
    replyContent: '',
    assignee: ''
  };
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 自動填寫院所名稱
  useEffect(() => {
    if (form.instCode.length >= 7 && instMap[form.instCode]) {
      setForm(prev => ({ ...prev, instName: instMap[form.instCode].name }));
    }
  }, [form.instCode, instMap]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.channel || !form.category || !form.instCode) return showToast("請填寫必填欄位", "error");
    setIsSubmitting(true);
    try {
      const ticketId = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(tickets.length + 1).padStart(4, '0')}`;
      const record = {
        ...form,
        ticketId,
        createdAt: new Date().toISOString(),
        isDeleted: false,
        replies: form.replyContent ? [{ user: form.receiver, time: new Date().toISOString(), content: form.replyContent }] : [],
        editLogs: []
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cs_records'), record);
      showToast("案件建立成功！案件號：" + ticketId, "success");
      setForm({ ...initialForm, receiver: currentUser.username });
    } catch (err) {
      showToast("儲存失敗：" + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center">
            <FileText className="mr-3 text-blue-600" /> 新增客服紀錄
          </h2>
          <button onClick={() => setShowCannedModal(true)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors">常用回覆</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">反映管道 *</label>
                <select required value={form.channel} onChange={e => setForm({...form, channel: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">
                  <option value="">-- 請選擇 --</option>
                  {channels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">醫事機構代碼 *</label>
                <input required type="text" maxLength={10} value={form.instCode} onChange={e => setForm({...form, instCode: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono" placeholder="10碼代碼或999" />
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">醫療院所名稱</label>
                <input type="text" value={form.instName} onChange={e => setForm({...form, instName: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" placeholder="系統將根據代碼自動檢索" />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">業務類別 *</label>
                <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">
                  <option value="">-- 請選擇 --</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">當前進度</label>
                <select value={form.progress} onChange={e => setForm({...form, progress: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold">
                  {progresses.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">反映問題詳細描述</label>
            <textarea rows="4" value={form.extraInfo} onChange={e => setForm({...form, extraInfo: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="請輸入客戶反映的具體內容..."></textarea>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-[0.98] disabled:opacity-50">
            {isSubmitting ? "正在儲存..." : "立即建立紀錄"}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * 4.2 紀錄維護與回覆 (MaintenanceArea)
 */
const MaintenanceArea = ({ currentUser, tickets, dbUsers, userMap, progresses, overdueHours, showToast, customPrompt, cannedMessages }) => {
  const [activeFilter, setActiveFilter] = useState('全部');
  const myTickets = useMemo(() => {
    return tickets.filter(t => !t.isDeleted && t.progress !== '結案' && (t.assignee === currentUser.username || t.receiver === currentUser.username));
  }, [tickets, currentUser.username]);

  const handleQuickReply = async (ticket, replyText) => {
    if (!replyText) return;
    try {
      const newReplies = [...(ticket.replies || []), { user: currentUser.username, time: new Date().toISOString(), content: replyText }];
      const updates = { replies: newReplies };
      if (replyText.includes("已完成") || replyText.includes("結案")) updates.progress = "結案";
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cs_records', ticket.id), updates);
      showToast("回覆已送出", "success");
    } catch (e) { showToast("更新失敗", "error"); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center">
          <Wrench className="mr-3 text-orange-500" /> 待處理案件維護
        </h2>
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex">
          {['全部', '待處理', '處理中'].map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === f ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>{f}</button>
          ))}
        </div>
      </div>

      {myTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
          <p className="text-slate-400 font-bold">目前沒有需要您處理的案件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {myTickets.filter(t => activeFilter === '全部' || t.progress === activeFilter).map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md mr-2">{t.ticketId}</span>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md ${t.progress === '待處理' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>{t.progress}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-bold">{new Date(t.receiveTime).toLocaleString()}</div>
              </div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 mb-2 truncate">{t.instName}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 h-10 leading-relaxed">{t.extraInfo}</p>
              
              <div className="flex items-center space-x-2">
                <input type="text" placeholder="輸入回覆內容或結案備註..." className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  onKeyDown={async (e) => { if(e.key === 'Enter') { await handleQuickReply(t, e.target.value); e.target.value = ''; } }} />
                <button onClick={async () => { const text = await customPrompt("請輸入回覆內容："); if(text) await handleQuickReply(t, text); }} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"><MessageCircle size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 4.3 歷史查詢區域 (HistoryArea)
 */
const HistoryArea = ({ tickets, userMap, setViewModalTicket, historyStartDate, historyEndDate, historyProgress, searchTerm, setHistoryStartDate, setHistoryEndDate, setHistoryProgress, setSearchTerm }) => {
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const matchDate = (!historyStartDate || t.receiveTime >= historyStartDate) && (!historyEndDate || t.receiveTime <= historyEndDate + 'T23:59');
      const matchProgress = historyProgress === '全部' || t.progress === historyProgress;
      const matchSearch = !searchTerm || t.instName.includes(searchTerm) || t.ticketId.includes(searchTerm) || t.extraInfo.includes(searchTerm);
      return !t.isDeleted && matchDate && matchProgress && matchSearch;
    });
  }, [tickets, historyStartDate, historyEndDate, historyProgress, searchTerm]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">搜尋關鍵字</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="案號、院所名稱..." />
          </div>
        </div>
        <div className="w-40 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">處理進度</label>
          <select value={historyProgress} onChange={e => setHistoryProgress(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl outline-none font-bold">
            <option value="全部">全部狀態</option>
            <option value="待處理">待處理</option>
            <option value="處理中">處理中</option>
            <option value="結案">已結案</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold [color-scheme:light] dark:[color-scheme:dark]" />
          <span className="self-center font-black text-slate-300">~</span>
          <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold [color-scheme:light] dark:[color-scheme:dark]" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">案號 / 院所</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">類別</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">負責同仁</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">狀態</th>
              <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {paginated.map(t => (
              <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                <td className="p-5">
                  <div className="font-mono text-[10px] text-blue-500 font-black mb-1">{t.ticketId}</div>
                  <div className="text-sm font-black text-slate-700 dark:text-slate-200">{t.instName}</div>
                </td>
                <td className="p-5"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.category}</span></td>
                <td className="p-5">
                  <div className="flex items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                    <UserAvatar username={t.assignee || t.receiver} photoURL={userMap[t.assignee || t.receiver]?.photoURL} className="w-6 h-6 mr-2" />
                    {t.assignee || t.receiver}
                  </div>
                </td>
                <td className="p-5">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black ${t.progress === '結案' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>{t.progress}</span>
                </td>
                <td className="p-5 text-center">
                  <button onClick={() => setViewModalTicket(t)} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-full text-slate-400 hover:text-blue-600 transition-all"><Info size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination currentPage={page} totalCount={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </div>
  );
};

// =============================================================================
// 5. 主應用程式組件 (Main App)
// =============================================================================
export default function App() {
  // --- A. 基礎狀態 ---
  const [currentUser, setCurrentUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false
  );
  
  // --- B. 導覽頁籤 ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  
  // --- C. 資料狀態 ---
  const [tickets, setTickets] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [overdueHours, setOverdueHours] = useState(24);
  const [holidays, setHolidays] = useState([]);

  // --- D. 歷史篩選連動 ---
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [searchTerm, setSearchTerm] = useState('');

  // --- E. 全域 UI 狀態 ---
  const [viewModalTicket, setViewModalTicket] = useState(null);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: '' });
  const [customDialog, setCustomDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', inputValue: '', onConfirm: null, onCancel: null });

  // ==================== 1. 初始化環境與身份 ====================
  useEffect(() => {
    // 遮蔽 Tailwind CDN 警告，防止控制台混亂
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
      originalWarn(...args);
    };

    // 自動補回樣式腳本以修復「一片白」問題
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
        if (!currentUser) setCurrentUser({ id: user.uid, username: '載入中...', role: ROLES.USER });
      } else {
        setCurrentUser(null);
      }
    });
    return () => { unsubscribe(); console.warn = originalWarn; };
  }, []);

  // ==================== 2. 資料即時同步 (Real-time Snapshots) ====================
  useEffect(() => {
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'cs_users');
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

  useEffect(() => {
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'cs_settings', 'dropdowns');
    return onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChannels(data.channels || ['電話', 'LINE', 'Email', '現場']);
        setCategories(data.categories || ['系統操作', '硬體問題', '法規諮詢', '其他']);
        setStatuses(data.statuses || ['一般', '急件', '非常急']);
        setProgresses(data.progresses || ['待處理', '處理中', '結案']);
        setCannedMessages(data.cannedMessages || []);
        setCategoryMapping(data.categoryMapping || {});
        setOverdueHours(data.overdueHours || 24);
        setHolidays(data.holidays || []);
      }
    });
  }, []);

  useEffect(() => {
    const recordsRef = collection(db, 'artifacts', appId, 'public', 'data', 'cs_records');
    return onSnapshot(recordsRef, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.receiveTime) - new Date(a.receiveTime)));
    });
  }, []);

  // ==================== 3. 主題切換與通知 ====================
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('cs_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: '' }), 3000);
  };

  const handleLogout = async () => {
    if (window.confirm("確定要登出系統嗎？")) {
      await signOut(auth);
      window.location.reload();
    }
  };

  // ==================== 4. 渲染 ====================
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', position: 'fixed', inset: 0, zIndex: 9999 }}>
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontWeight: 'bold', color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '14px' }}>系統啟動中，正在載入雲端配置...</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'new', label: '新增紀錄', icon: FileText, roles: [ROLES.ADMIN, ROLES.USER] },
    { id: 'maintain', label: '紀錄維護', icon: Wrench, roles: [ROLES.ADMIN, ROLES.USER] },
    { id: 'list', label: '歷史查詢', icon: History, roles: [ROLES.ADMIN, ROLES.USER, ROLES.VIEWER] },
    { id: 'dashboard', label: '進階統計', icon: PieChart, roles: [ROLES.ADMIN, ROLES.USER, ROLES.VIEWER] },
    { id: 'settings', label: '系統設定', icon: Settings, roles: [ROLES.ADMIN] }
  ];

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* 側邊導覽 */}
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
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hidden md:block transition-all hover:bg-blue-50 hover:text-blue-600"><Menu size={20} /></button>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{TABS.find(t => t.id === activeTab)?.label}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-yellow-500 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {activeTab === 'new' && (
            <TicketForm 
              currentUser={currentUser} channels={channels} categories={categories} statuses={statuses} 
              progresses={progresses} dbUsers={dbUsers} setShowCannedModal={setShowCannedModal} 
              showToast={showToast} instMap={instMap} tickets={tickets}
            />
          )}

          {activeTab === 'maintain' && (
            <MaintenanceArea 
              currentUser={currentUser} tickets={tickets} dbUsers={dbUsers} userMap={userMap} 
              progresses={progresses} overdueHours={overdueHours} showToast={showToast} 
              customPrompt={(msg) => Promise.resolve(window.prompt(msg))} cannedMessages={cannedMessages}
            />
          )}

          {activeTab === 'list' && (
            <HistoryArea 
              tickets={tickets} userMap={userMap} setViewModalTicket={setViewModalTicket} 
              historyStartDate={historyStartDate} setHistoryStartDate={setHistoryStartDate}
              historyEndDate={historyEndDate} setHistoryEndDate={setHistoryEndDate}
              historyProgress={historyProgress} setHistoryProgress={setHistoryProgress}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            />
          )}
          
          {(activeTab === 'settings' || activeTab === 'dashboard') && (
              <div className="flex flex-col items-center justify-center h-full py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700">
                  <PieChart size={64} className="text-slate-200 mb-6" />
                  <p className="text-slate-400 font-bold">此區塊模組正在掛載中，請確保資料庫連線正確</p>
              </div>
          )}
        </div>
      </main>

      {/* 彈窗渲染 */}
      {viewModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setViewModalTicket(null)}>
           <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">案件詳細資訊</h3>
                   <button onClick={() => setViewModalTicket(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
               </div>
               <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-sm">
                       <div><span className="text-slate-400 block mb-1">案號</span><span className="font-bold font-mono">{viewModalTicket.ticketId}</span></div>
                       <div><span className="text-slate-400 block mb-1">反映時間</span><span className="font-bold">{new Date(viewModalTicket.receiveTime).toLocaleString()}</span></div>
                       <div><span className="text-slate-400 block mb-1">醫事機構</span><span className="font-bold">{viewModalTicket.instName}</span></div>
                       <div><span className="text-slate-400 block mb-1">類別</span><span className="font-bold">{viewModalTicket.category}</span></div>
                   </div>
                   <div className="p-4 border border-slate-100 dark:border-slate-700 rounded-2xl">
                       <span className="text-slate-400 text-xs block mb-2 font-black uppercase tracking-widest">反映內容</span>
                       <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{viewModalTicket.extraInfo}</p>
                   </div>
                   <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                       <span className="text-blue-400 text-xs block mb-2 font-black uppercase tracking-widest">回覆軌跡</span>
                       <p className="text-blue-800 dark:text-blue-300 whitespace-pre-wrap text-sm">{formatRepliesHistory(viewModalTicket.replies, viewModalTicket.replyContent)}</p>
                   </div>
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
