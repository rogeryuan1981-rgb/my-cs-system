import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  PhoneCall, MessageCircle, Clock, Save, FileText, Search, CheckCircle, AlertCircle, User, 
  List, LayoutDashboard, Plus, X, Settings, Trash2, Upload, Database, Edit, UserPlus, 
  Shield, Lock, Calendar, Copy, Check, ArrowUp, ArrowDown, MessageSquare, Download, 
  Menu, Eye, Moon, Sun, Camera, ArrowRight, Pin, Timer, ChevronLeft, ChevronRight
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, writeBatch, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- 強制設定 Tailwind CSS 支援 Class 切換深色模式 ---
if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || {};
  window.tailwind.config = window.tailwind.config || {};
  window.tailwind.config.darkMode = 'class';
}

// --- System Variables ---
const APP_VERSION = "v3.8 (全面現代化提示版)";

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
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
const storage = getStorage(app);
const functions = getFunctions(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Secondary App for Admin to create users without logging themselves out
let secondaryApp;
try {
  secondaryApp = getApp('SecondaryApp');
} catch (e) {
  secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
}
const secondaryAuth = getAuth(secondaryApp);

const ROLES = { ADMIN: "後台管理者", USER: "一般使用者", VIEWER: "紀錄檢視者" };

const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const getLastDayOfMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};
const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getEmailFromUsername = (username) => `${encodeURIComponent(username).replace(/%/g, '_')}@cs.local`.toLowerCase();

const getInitialForm = (username = '', channelsArr = [], progressesArr = []) => ({
  receiveTime: getFormatDate(), callEndTime: '',
  channel: Array.isArray(channelsArr) && channelsArr.length > 0 ? channelsArr[0] : '',
  receiver: username, instCode: '', instName: '', instLevel: '', category: '', status: '',
  extraInfo: '', questioner: '', replyContent: '', closeTime: '',
  progress: Array.isArray(progressesArr) && progressesArr.length > 0 ? progressesArr[0] : '待處理',
  assignee: '', replies: [], editLogs: []
});

const formatRepliesHistory = (replies, fallbackContent) => {
  if (replies && replies.length > 0) {
    return replies.map(r => `${r.content} (${r.user} ${new Date(r.time).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })})`).join('\n');
  }
  return fallbackContent || '';
};

const getLatestReply = (replies, fallbackContent) => {
  if (replies && replies.length > 0) return replies[replies.length - 1].content;
  return fallbackContent || '';
};

// --- Sub-Components ---
const UserAvatar = ({ username, photoURL, className = "w-8 h-8 text-xs" }) => {
  if (photoURL) return <img src={photoURL} alt={username} className={`rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-600 ${className}`} />;
  return (
    <div className={`rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0 shadow-sm border border-blue-200 dark:border-blue-800 ${className}`}>
      {username ? username.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

const LineChart = ({ datasets, labels, isDarkMode }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  if (!Array.isArray(datasets) || datasets.length === 0 || !labels) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500">無數據</div>;
  const allData = datasets.flatMap(ds => ds.data || []);
  if (allData.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500">無數據</div>;

  const maxVal = Math.max(...allData, 10);
  const height = 260, width = 800, paddingX = 40, paddingY = 40;
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const axisTextColor = isDarkMode ? "#94a3b8" : "#94a3b8";
  const bgStroke = isDarkMode ? "#1e293b" : "#ffffff";

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-4 mb-6 h-8 items-center">
        {datasets.map((ds, idx) => {
          const isHovered = hoveredPoint?.dsIdx === idx;
          return (
            <div key={ds.label} className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-300 ${isHovered ? 'bg-slate-200 dark:bg-slate-700 scale-110 shadow-sm' : ''}`}>
              <span className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: ds.color }}></span>
              <span className={isDarkMode ? "text-slate-200" : "text-slate-700"}>{ds.label}</span>
            </div>
          );
        })}
      </div>
      <div className="w-full overflow-x-auto relative scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 md:h-80 drop-shadow-sm min-w-[600px]">
          {[0, 0.5, 1].map(ratio => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <g key={ratio}>
                <line x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke={gridColor} strokeDasharray="4 4" />
                <text x={paddingX - 10} y={y + 4} fontSize="10" fill={axisTextColor} textAnchor="end">{Math.round(maxVal * ratio)}</text>
              </g>
            );
          })}
          {datasets.map((ds) => {
            const points = ds.data.map((val, i) => `${paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)))},${height - paddingY - (val / maxVal) * (height - paddingY * 2)}`).join(' ');
            return <polyline key={`line-${ds.label}`} points={points} fill="none" stroke={ds.color} strokeWidth={ds.dashed ? "2" : "3"} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ds.dashed ? '6 6' : 'none'} className="transition-all duration-500" />;
          })}
          {datasets.map((ds, dsIdx) => ds.data.map((val, i) => {
            if (hoveredPoint?.dsIdx === dsIdx && hoveredPoint?.i === i) return null;
            const x = paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)));
            const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
            let dy = -12, dx = 0;
            if (dsIdx === 0) dy = -22;
            if (dsIdx === 1) dy = -10;
            if (dsIdx === 2) { dy = 14; dx = 10; }
            if (dsIdx === 3) { dy = 24; dx = -10; }
            if (y + dy > height - paddingY - 5) dy = -10;

            return (
              <g key={`point-${ds.label}-${i}`} onMouseEnter={() => setHoveredPoint({ dsIdx, i })} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r="4" fill={isDarkMode ? "#1e293b" : "#ffffff"} stroke={ds.color} strokeWidth="2" className="transition-all duration-200" />
                {val > 0 && <text x={x + dx} y={y + dy} fontSize="11" fill={ds.color} textAnchor="middle" fontWeight="black" className="select-none transition-all duration-200" stroke={bgStroke} strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{val}</text>}
              </g>
            );
          }))}
          {hoveredPoint && (() => {
            const { dsIdx, i } = hoveredPoint;
            const ds = datasets[dsIdx];
            const val = ds.data[i];
            const x = paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)));
            const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
            return (
              <g className="pointer-events-none">
                <circle cx={x} cy={y} r="7" fill={isDarkMode ? "#1e293b" : "#ffffff"} stroke={ds.color} strokeWidth="3" />
                <text x={x} y={y - 15} fontSize="18" fill={ds.color} textAnchor="middle" fontWeight="black" stroke={bgStroke} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">{val}</text>
              </g>
            );
          })()}
          {labels.map((lbl, i) => <text key={`lbl-${i}`} x={paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)))} y={height - 10} fontSize="11" fill={axisTextColor} textAnchor="middle" fontWeight="bold">{lbl}</text>)}
        </svg>
      </div>
    </div>
  );
};

const CannedMessagesModal = ({ messages, onClose }) => {
  const [copyId, setCopyId] = useState(null);
  const handleCopy = (text, idx) => {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); setCopyId(idx); setTimeout(() => { setCopyId(null); onClose(); }, 500); } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(ta);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100"><MessageSquare size={20} className="mr-2 text-blue-600 dark:text-blue-400"/> 選擇罐頭回覆</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {(Array.isArray(messages)?messages:[]).map((m, idx) => (
            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 hover:border-blue-300 dark:border-blue-500 hover:shadow-md transition-all group relative cursor-pointer" onClick={() => handleCopy(m, idx)}>
              <p className="text-sm text-slate-600 dark:text-slate-200 line-clamp-4 pr-6">{m}</p>
              <button className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400">
                {copyId === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          ))}
          {(!messages || messages.length === 0) && <p className="text-xs text-slate-400 text-center py-6">目前尚無罐頭文字。</p>}
        </div>
      </div>
    </div>
  );
};

const DropdownManager = ({ title, dbKey, items, showToast, showConfirm }) => {
  const [newItem, setNewItem] = useState('');
  const [draggedIdx, setDraggedIdx] = useState(null);
  const safeItems = Array.isArray(items) ? items : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim() || safeItems.includes(newItem.trim())) return;
    const newArray = [...safeItems, newItem.trim()];
    const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
    const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
    await setDoc(docRef, { [dbKey]: newArray }, { merge: true });
    setNewItem('');
    showToast(`成功新增「${newItem.trim()}」`);
  };

  const handleRemove = (itemToRemove) => {
    showConfirm(`確定要刪除「${itemToRemove}」嗎？`, async () => {
      const newArray = safeItems.filter(i => i !== itemToRemove);
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { [dbKey]: newArray }, { merge: true });
      showToast(`已刪除「${itemToRemove}」`);
    });
  };

  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) return;
    const newItems = [...safeItems];
    const [moved] = newItems.splice(draggedIdx, 1);
    newItems.splice(dropIdx, 0, moved);
    const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
    const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
    await setDoc(docRef, { [dbKey]: newItems }, { merge: true });
    setDraggedIdx(null);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 flex flex-col h-full">
      <h4 className="font-bold text-sm mb-4 text-slate-700 dark:text-slate-200">{title}</h4>
      <form onSubmit={handleAdd} className="flex mb-4 gap-2 shrink-0">
        <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} className="flex-1 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="新增項目..."/>
        <button type="submit" className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"><Plus size={18}/></button>
      </form>
      <ul className="space-y-2 overflow-y-auto flex-1 pr-2 min-h-[150px]">
        {safeItems.map((item, idx) => (
          <li key={item} draggable onDragStart={(e) => { setDraggedIdx(idx); e.dataTransfer.effectAllowed = "move"; }} onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, idx)} onDragEnd={() => setDraggedIdx(null)} className={`flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm text-sm group ${draggedIdx === idx ? 'opacity-40' : ''}`}>
            <div className="flex items-center flex-1 overflow-hidden">
              <div className="cursor-grab text-slate-300 hover:text-indigo-500 mr-2 p-1"><Menu size={16} /></div>
              <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{item}</span>
            </div>
            <button type="button" onClick={() => handleRemove(item)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-2"><Trash2 size={16}/></button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CategoryMappingManager = ({ categories, mapping, showToast }) => {
  const [localMap, setLocalMap] = useState({});
  useEffect(() => setLocalMap(mapping || {}), [mapping]);
  const handleSaveMapping = async () => {
    const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
    const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
    await setDoc(docRef, { categoryMapping: localMap }, { merge: true });
    showToast("大類別設定已儲存成功！");
  };
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 mt-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h4 className="font-black text-slate-800 dark:text-slate-100 flex items-center"><Database size={18} className="mr-2 text-indigo-600"/> 大類別歸屬設定</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">設定後，進階統計區將會自動合併顯示大類別數據</p>
        </div>
        <button onClick={handleSaveMapping} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black text-sm">儲存大類別設定</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Array.isArray(categories)?categories:[]).map(cat => (
          <div key={cat} className="flex items-center bg-white dark:bg-slate-700 p-3 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
             <span className="text-sm font-bold text-slate-600 dark:text-slate-300 w-1/2 truncate border-r border-slate-100 dark:border-slate-600 pr-2 mr-2" title={cat}>{cat}</span>
             <input type="text" value={localMap[cat] || ''} onChange={e => setLocalMap(prev => ({ ...prev, [cat]: e.target.value }))} placeholder="輸入大類別" className="w-1/2 p-1 text-sm font-medium outline-none bg-transparent text-slate-800 dark:text-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------
// --- 加入防抖 Hook ---
// -------------------------------------------------
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// -------------------------------------------------
// --- 主應用程式 App ---
// -------------------------------------------------

// 輔助組件：分頁器 (補回遺失的元件)
const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalCount === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center px-8 py-5 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 rounded-b-[2.5rem] gap-4">
      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
        共 <span className="text-blue-600 dark:text-blue-400 font-black">{totalCount}</span> 筆案件
      </span>
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1} 
          className="p-2 rounded-xl disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-500 dark:text-slate-400"
        >
          <ChevronLeft size={20}/>
        </button>
        <span className="text-sm font-black px-4 dark:text-white">{currentPage} / {totalPages}</span>
        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages} 
          className="p-2 rounded-xl disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-500 dark:text-slate-400"
        >
          <ChevronRight size={20}/>
        </button>
      </div>
    </div>
  );
};

// 輔助組件：精緻的資訊卡片 (用於檢視模式)
const InfoCard = ({ label, value, isHighlight }) => (
  <div className={`p-4 rounded-2xl border ${isHighlight ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
    <span className={`font-black text-sm ${isHighlight ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>{value || '-'}</span>
  </div>
);

// 輔助組件：表單輸入框 (用於強制維護模式)
// 輔助組件：表單輸入框 (防彈安全版，保證不白屏)
const EditField = ({ label, val, setVal, type = "text", options = [] }) => {
  // 強制確保 options 絕對是陣列，防止 .map 崩潰
  const safeOptions = Array.isArray(options) ? options : [];
  
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      {type === "select" ? (
        <select value={val || ''} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white">
          <option value="">未指定</option>
          {safeOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={val || ''} onChange={e => setVal(e.target.value)} rows="4" className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
      ) : (
        <input type={type} value={val || ''} onChange={e => setVal(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" />
      )}
    </div>
  );
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => typeof localStorage !== 'undefined' ? localStorage.getItem('cs_theme') === 'dark' : false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (typeof localStorage !== 'undefined') localStorage.setItem('cs_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  
  const [loginForm, setLoginForm] = useState(() => {
    const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('cs_last_user') : '';
    return { username: savedUser || '', password: '' };
  });
  
  const [activeTab, setActiveTab] = useState('form'); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' });

  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [overdueHours, setOverdueHours] = useState(24);
  const [holidays, setHolidays] = useState([]); 
  const [showCannedModal, setShowCannedModal] = useState(false);

  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState([]); 

  const [viewModalTicket, setViewModalTicket] = useState(null);
  const [isEditingModal, setIsEditingModal] = useState(false);
  const [modalEditForm, setModalEditForm] = useState(null);

  useEffect(() => { setSelectedTickets([]); }, [activeTab]);

  const [formData, setFormData] = useState(getInitialForm());
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      channel: prev.channel || (Array.isArray(channels) && channels.length > 0 ? channels[0] : ''),
      progress: prev.progress || (Array.isArray(progresses) && progresses.length > 0 ? progresses[0] : '')
    }));
  }, [channels, progresses]);

  const [searchTerm, setSearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [sortConfig, setSortConfig] = useState({ key: 'receiveTime', direction: 'desc' });

  const [allRecordsSearchTerm, setAllRecordsSearchTerm] = useState('');

  // --- 防抖狀態 ---
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedAllRecordsSearchTerm = useDebounce(allRecordsSearchTerm, 300);
  
  // --- 分頁狀態 ---
  const [historyPage, setHistoryPage] = useState(1);
  const [allRecordsPage, setAllRecordsPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => { 
    setSelectedTickets([]); 
    setHistoryPage(1); 
  }, [debouncedSearchTerm, historyStartDate, historyEndDate, historyProgress, sortConfig, categoryMapping]);

  useEffect(() => { 
    setSelectedTickets([]); 
    setAllRecordsPage(1); 
  }, [debouncedAllRecordsSearchTerm, sortConfig, categoryMapping]);
  
  const [dashStartDate, setDashStartDate] = useState(getFirstDayOfMonth());
  const [dashEndDate, setDashEndDate] = useState(getLastDayOfMonth());
  
  const [personnelStartDate, setPersonnelStartDate] = useState(getFirstDayOfMonth());
  const [personnelEndDate, setPersonnelEndDate] = useState(getLastDayOfMonth());
  
  const [trendCategory, setTrendCategory] = useState('全類別');
  const [categoryViewMode, setCategoryViewMode] = useState('detail');
  const [personnelViewMode, setPersonnelViewMode] = useState('assignee');

  const [settingsTab, setSettingsTab] = useState('general');
  const [isTriggering, setIsTriggering] = useState(false); 

  const [newHoliday, setNewHoliday] = useState({ start: '', end: '', note: '' }); 
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', delegate: '' }); 

  const [maintainSearchTerm, setMaintainSearchTerm] = useState('');
  const debouncedMaintainSearchTerm = useDebounce(maintainSearchTerm, 300);
  const [maintainSortOrder, setMaintainSortOrder] = useState('desc');
  const [maintainModal, setMaintainModal] = useState(null);
  const [maintainForm, setMaintainForm] = useState({ progress: '', assignee: '', newReply: '', extraInfo: '' });

  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  const [newInst, setNewInst] = useState({ code: '', name: '', level: '診所' });
  const [isImporting, setIsImporting] = useState(false);
  const [instSearchTerm, setInstSearchTerm] = useState('');
  
  const [newUser, setNewUser] = useState({ username: '', password: '', role: ROLES.USER, lineUserId: '' });
  const [pwdChangeForm, setPwdChangeForm] = useState({ newPwd: '', confirmPwd: '' });
  const [pwdChangeMsg, setPwdChangeMsg] = useState('');

  const userMap = useMemo(() => {
    const map = {}; dbUsers.forEach(u => map[u.username] = u); return map;
  }, [dbUsers]);

// --- 現代化提示系統與強制改密碼 State ---
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, msg: '', onConfirm: null });
  const [showForcePwdModal, setShowForcePwdModal] = useState(false);
  const [forcePwdForm, setForcePwdForm] = useState({ newPwd: '', confirmPwd: '' }); // ✅ 修復：補上漏掉的密碼表單狀態

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };
  
  const showConfirm = (msg, onConfirmCallback) => {
    setConfirmDialog({ show: true, msg, onConfirm: onConfirmCallback });
  };

  // Auth State Sync
  useEffect(() => {
    if (firebaseUser && !firebaseUser.isAnonymous && dbUsers.length > 0) {
      const matchedUser = dbUsers.find(u => getEmailFromUsername(u.username) === firebaseUser.email);
      if (matchedUser) {
        setCurrentUser(matchedUser);
        if (typeof localStorage !== 'undefined') localStorage.setItem('cs_last_user', matchedUser.username);
        
        if (matchedUser.forcePasswordChange) {
          setShowForcePwdModal(true);
        } else {
          setShowForcePwdModal(false);
        }
      } else {
        setCurrentUser(null);
      }
    } else if (!firebaseUser || firebaseUser.isAnonymous) {
      setCurrentUser(null);
    }
  }, [firebaseUser, dbUsers]);

  const activeUser = dbUsers.find(u => u.id === currentUser?.id) || currentUser;

  useEffect(() => {
    if (activeUser) {
      setLeaveForm({ start: activeUser.leaveStart || '', end: activeUser.leaveEnd || '', delegate: activeUser.delegateUser || '' });
    }
  }, [activeUser]);

  // --- Initialization ---
  useEffect(() => {
    if (!document.getElementById('xlsx-script')) {
      const script = document.createElement('script'); script.id = 'xlsx-script';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.body.appendChild(script);
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      if (!fUser) {
        const initAuth = async () => {
          try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
            else await signInAnonymously(auth);
          } catch (error) { console.error("Firebase Auth Error:", error); }
        };
        initAuth();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- Data Fetching ---
// --- Data Fetching ---
  useEffect(() => {
    if (!firebaseUser) return;
    const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : []; 
    const buildPath = (colName) => baseDbPath.length ? collection(db, ...baseDbPath, colName) : collection(db, colName);
    const buildDocPath = (colName, docId) => baseDbPath.length ? doc(db, ...baseDbPath, colName, docId) : doc(db, colName, docId);

    const unsubUsers = onSnapshot(query(buildPath('cs_users')), snap => { setDbUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
    const unsubTickets = onSnapshot(query(buildPath('cs_records')), snap => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubInst = onSnapshot(query(buildPath('mohw_institutions')), snap => {
      let instList = []; const map = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.isChunk && data.payload) {
          try { 
            JSON.parse(data.payload).forEach(item => { 
              // 🔽 這裡修復了原先 instListList 的拼寫錯誤，改回正確的 instList
              instList.push({ id: doc.id, isChunk: true, ...item }); 
              map[item.code] = { name: item.name, level: item.level }; 
            }); 
          } catch (e) {
            console.error("院所資料解析錯誤:", e);
          }
        } else { 
          instList.push({ id: doc.id, isChunk: false, ...data }); 
          map[data.code] = { name: data.name, level: data.level }; 
        }
      });
      setInstitutions(instList); setInstMap(map);
    });
    
    const unsubSettings = onSnapshot(buildDocPath('cs_settings', 'dropdowns'), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChannels(data.channels || []); setCategories(data.categories || []);
        setStatuses(data.statuses || []); setProgresses(data.progresses || []);
        setCannedMessages(data.cannedMessages || []); setCategoryMapping(data.categoryMapping || {});
        setOverdueHours(data.overdueHours || 24);
        setHolidays(data.holidays || []);
      } else {
        setDoc(buildDocPath('cs_settings', 'dropdowns'), {
          channels: ["電話", "LINE"], categories: ["慢防-成人預防保健", "其他"], statuses: ["詢問步驟", "其他"],
          progresses: ["待處理", "處理中", "待回覆", "結案"], cannedMessages: ["請提供更詳細的相關資訊以便查詢"], categoryMapping: {}, overdueHours: 24, holidays: []
        });
      }
    });

    return () => { unsubUsers(); unsubTickets(); unsubInst(); unsubSettings(); };
  }, [firebaseUser]);

// --- Auth Handlers ---
  const handleForceChangePassword = async (e) => {
    e.preventDefault();
    if (forcePwdForm.newPwd !== forcePwdForm.confirmPwd) return showToast('兩次密碼不一致', 'error');
    if (forcePwdForm.newPwd.length < 6) return showToast('密碼長度需至少 6 碼', 'error');
    try {
      await updatePassword(auth.currentUser, forcePwdForm.newPwd);
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', currentUser.id) : doc(db, 'cs_users', currentUser.id);
      await updateDoc(docRef, { forcePasswordChange: false });
      showToast('密碼設定成功，歡迎使用系統！');
      setShowForcePwdModal(false);
      setActiveTab('form');
    } catch (error) {
      showToast('密碼更新失敗: ' + error.message, 'error');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedUsername = loginForm.username.trim(); // ✅ 自動清除前後空白
    const email = getEmailFromUsername(trimmedUsername);
    try {
      await signInWithEmailAndPassword(auth, email, loginForm.password);
      const matchedUser = dbUsers.find(u => u.username === trimmedUsername);
      if (matchedUser) {
        if (typeof localStorage !== 'undefined') localStorage.setItem('cs_last_user', matchedUser.username);
        setFormData(getInitialForm(matchedUser.username, channels, progresses));
        
        if (matchedUser.forcePasswordChange) {
          setShowForcePwdModal(true);
        } else {
          setActiveTab(matchedUser.role === ROLES.VIEWER ? 'list' : 'form');
        }
        setAuthError('');
      } else {
        setAuthError('登入成功，但資料庫無您的權限紀錄，請聯絡管理員。');
        await auth.signOut();
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        const legacyUser = dbUsers.find(u => u.username === trimmedUsername && u.password === loginForm.password);
        if (legacyUser) {
          try {
            await createUserWithEmailAndPassword(auth, email, loginForm.password);
            if (typeof localStorage !== 'undefined') localStorage.setItem('cs_last_user', legacyUser.username);
            setFormData(getInitialForm(legacyUser.username, channels, progresses));
            setActiveTab(legacyUser.role === ROLES.VIEWER ? 'list' : 'form');
            setAuthError('');
          } catch (createErr) {
            if (createErr.code === 'auth/operation-not-allowed') setAuthError('❌ 請先至 Firebase 後台啟用「電子郵件/密碼」登入！');
            else setAuthError('帳號升級失敗：' + createErr.message);
          }
        } else {
          setAuthError('❌ 帳號或密碼錯誤！請確認大小寫與是否有空白。');
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError('❌ 系統錯誤：請先至 Firebase 後台啟用「電子郵件/密碼」登入！');
      } else {
        setAuthError('登入失敗：' + err.message);
      }
    }
  };

  const handleCreateFirstAdmin = async (e) => {
    e.preventDefault();
    if (dbUsers.length > 0) return;
    if (loginForm.password.length < 6) return setAuthError('密碼長度至少需要 6 個字元！');
    try {
      const trimmedUsername = loginForm.username.trim(); // ✅ 自動清除空白
      const email = getEmailFromUsername(trimmedUsername);
      await createUserWithEmailAndPassword(auth, email, loginForm.password);
      
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'cs_users') : collection(db, 'cs_users'), { 
        username: trimmedUsername, 
        role: ROLES.ADMIN, 
        createdAt: new Date().toISOString(), 
        forcePasswordChange: false 
      });
      
      setAuthError('');
      setActiveTab('form');
      setFormData(getInitialForm(trimmedUsername, channels, progresses));
    } catch (e) { 
      if (e.code === 'auth/operation-not-allowed') setAuthError('❌ 請先至 Firebase 後台啟用「電子郵件/密碼」登入！');
      else setAuthError('建立失敗：' + e.message); 
    }
  };

  const handleLogout = async () => { 
    await auth.signOut();
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
      else await signInAnonymously(auth);
    } catch (e) {}
    setCurrentUser(null); 
    setLoginForm(prev => ({ ...prev, password: '' })); 
    setActiveTab('form'); 
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN) return;
    const trimmedUsername = newUser.username.trim(); // ✅ 自動清除空白
    if (dbUsers.some(u => u.username === trimmedUsername)) return showToast('帳號名稱已存在', 'error');
    if (newUser.password.length < 6) return showToast('密碼長度至少需要 6 個字元！', 'error');
    try {
      const email = getEmailFromUsername(trimmedUsername);
      await createUserWithEmailAndPassword(secondaryAuth, email, newUser.password);
      await secondaryAuth.signOut();

      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'cs_users') : collection(db, 'cs_users'), { 
        username: trimmedUsername, 
        role: newUser.role, 
        createdAt: new Date().toISOString(), 
        region: '',
        lineUserId: newUser.lineUserId.trim(),
        forcePasswordChange: true
      });
      setNewUser({ username: '', password: '', role: ROLES.USER, lineUserId: '' });
      showToast(`用戶「${trimmedUsername}」建立成功！`);
    } catch(e) { 
        if (e.code === 'auth/operation-not-allowed') showToast('❌ 請至後台啟用「電子郵件」登入', 'error');
        else if (e.code === 'auth/email-already-in-use') showToast('❌ 此帳號名稱曾被建立且底層尚未刪除，請換一個名稱', 'error');
        else showToast('新增失敗：' + e.message, 'error');
    }
  };

  const handleDeleteUser = (id) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    showConfirm('確定要停用此使用者嗎？\n(注意：基於資安限制，前端僅能移除系統存取權，無法刪除底層 Auth 帳號，如需徹底刪除請至 Firebase 後台處理)', async () => {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await deleteDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', id) : doc(db, 'cs_users', id));
      showToast('用戶已成功停用');
    });
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    if (pwdChangeForm.newPwd !== pwdChangeForm.confirmPwd) return setPwdChangeMsg('❌ 兩次密碼不一致！');
    try {
      await updatePassword(auth.currentUser, pwdChangeForm.newPwd);
      setPwdChangeMsg('✅ 密碼更新成功！下次登入請使用新密碼。'); setPwdChangeForm({ newPwd: '', confirmPwd: '' }); setTimeout(() => setPwdChangeMsg(''), 5000);
    } catch (e) { setPwdChangeMsg('❌ 密碼更新失敗：' + e.message); }
  };

  const handleUpdateUserRegion = async (id, regionValue) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', id) : doc(db, 'cs_users', id), { region: regionValue.trim() });
    } catch (e) {
      console.error("更新地區失敗", e);
    }
  };

  const handleUpdateUserLineId = async (id, lineIdValue) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', id) : doc(db, 'cs_users', id), { lineUserId: lineIdValue.trim() });
    } catch (e) {
      console.error("更新 LINE UID 失敗", e);
    }
  };

  const handleSaveOverdueHours = async () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { overdueHours }, { merge: true });
      showToast("逾期判定時數已成功更新！");
    } catch (e) {
      showToast("更新失敗：" + e.message, 'error');
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!newHoliday.start || !newHoliday.end || !newHoliday.note) return showToast("請填寫完整放假資訊", 'error');
    if (newHoliday.start > newHoliday.end) return showToast("開始日期不能晚於結束日期", 'error');
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      const updatedHolidays = [...holidays, newHoliday].sort((a,b) => a.start.localeCompare(b.start));
      await setDoc(docRef, { holidays: updatedHolidays }, { merge: true });
      setNewHoliday({ start: '', end: '', note: '' });
      showToast('國定假日新增成功！');
    } catch(e) {
      showToast("新增假日失敗：" + e.message, 'error');
    }
  };

  const handleRemoveHoliday = (idx) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    showConfirm("確定要刪除此假日設定嗎？", async () => {
      try {
        const newHolidays = holidays.filter((_, i) => i !== idx);
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
        await setDoc(docRef, { holidays: newHolidays }, { merge: true });
        showToast("假日設定已移除");
      } catch (e) {
        showToast("刪除失敗：" + e.message, 'error');
      }
    });
  };

  const handleSaveLeave = async (e) => {
    e.preventDefault();
    if (leaveForm.start && leaveForm.end && leaveForm.start > leaveForm.end) return showToast("請假開始日期不能晚於結束日期", 'error');
    if ((leaveForm.start || leaveForm.end) && !leaveForm.delegate) return showToast("請選擇案件代理人", 'error');
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', activeUser.id) : doc(db, 'cs_users', activeUser.id);
      await updateDoc(docRef, {
        leaveStart: leaveForm.start,
        leaveEnd: leaveForm.end,
        delegateUser: leaveForm.delegate
      });
      showToast('代理人設定已儲存成功！休假期間系統會自動將您的案件推播轉給代理人。');
    } catch (error) {
      showToast('儲存代理失敗：' + error.message, 'error');
    }
  };

  const handleClearLeave = () => {
    showConfirm("確定要清除代理人設定並恢復自己接收通知嗎？", async () => {
      try {
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', activeUser.id) : doc(db, 'cs_users', activeUser.id);
        await updateDoc(docRef, { leaveStart: '', leaveEnd: '', delegateUser: '' });
        setLeaveForm({ start: '', end: '', delegate: '' });
        showToast('已成功解除代理設定！');
      } catch (error) {
        showToast('清除失敗：' + error.message, 'error');
      }
    });
  };

  const handleManualTrigger = () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    showConfirm("確定要現在「立即掃描並發送」逾期通知嗎？", async () => {
      setIsTriggering(true);
      try {
        const triggerFn = httpsCallable(functions, 'manualTriggerOverdue');
        const res = await triggerFn();
        showToast(`手動執行完畢！🎉\n本次共發送給 ${res.data.notifiedCount} 位同仁，並成功標記了 ${res.data.markedCount} 筆案件。`);
      } catch (error) {
        showToast("觸發失敗，請確認後端是否已更新成功：" + error.message, 'error');
      } finally {
        setIsTriggering(false);
      }
    });
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeUser) return;
    if (!file.type.startsWith('image/')) return showToast('請上傳圖片檔案！', 'error');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150; let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        try {
          const storageRef = ref(storage, `avatars/${appId}/${activeUser.id}_${Date.now()}.jpg`);
          await uploadString(storageRef, dataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(storageRef);

          const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
          const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', activeUser.id) : doc(db, 'cs_users', activeUser.id);
          await updateDoc(docRef, { photoURL: downloadUrl });
          showToast('個人圖像更新成功！已儲存至 Cloud Storage。');
        } catch (error) { 
          showToast('圖像更新失敗，請稍後再試。錯誤原因：' + error.message, 'error'); 
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file); e.target.value = null; 
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    if (name === 'progress' && value === '結案' && !formData.closeTime) newFormData.closeTime = getFormatDate();
    if (name === 'progress' && value !== '結案' && formData.closeTime) newFormData.closeTime = '';
    if (name === 'progress' && value === '結案') newFormData.assignee = '';
    setFormData(newFormData);
  };

  const handleInstCodeBlur = () => {
    if (!formData.instCode) return;
    const rawCode = formData.instCode.trim();
    if (rawCode === '999') {
      setFormData(prev => ({ ...prev, instCode: '999', instLevel: '', instName: prev.instName.includes('查無資料') ? '' : prev.instName }));
      return;
    }
    setIsLookingUp(true);
    setTimeout(() => {
      const paddedCode = rawCode.padStart(10, '0');
      let data = instMap[rawCode] || instMap[paddedCode];
      if (data) setFormData(prev => ({ ...prev, instCode: rawCode.length < 10 ? paddedCode : rawCode, instName: data.name, instLevel: data.level }));
      else setFormData(prev => ({ ...prev, instName: '查無資料，請確認代碼或手動新增', instLevel: '' }));
      setIsLookingUp(false);
    }, 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) { setSubmitStatus({ type: 'error', msg: '儲存失敗：您沒有新增權限' }); return; }
    
    const code = formData.instCode ? formData.instCode.trim() : '';
    if (!code || (code !== '999' && !/^\d{10}$/.test(code))) return setSubmitStatus({ type: 'error', msg: '儲存失敗：院所代碼必須為 10 碼數字或 999' });
    if (!formData.channel || !formData.category || !formData.status || !formData.progress) return setSubmitStatus({ type: 'error', msg: '請確實選擇下拉選單選項' });
    if (!formData.extraInfo?.trim() || !formData.replyContent?.trim()) return setSubmitStatus({ type: 'error', msg: '問題描述與答覆不能為空' });

    try {
      setSubmitStatus({ type: 'loading', msg: '儲存中...' });
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const todayTickets = tickets.filter(t => t.ticketId && t.ticketId.startsWith(todayStr));
      let maxSeq = 0;
      todayTickets.forEach(t => { const seq = parseInt(t.ticketId.slice(8), 10); if (!isNaN(seq) && seq > maxSeq) maxSeq = seq; });
      const newTicketId = todayStr + String(maxSeq + 1).padStart(5, '0');

      const initialReplies = formData.replyContent ? [{ time: getFormatDate(), user: currentUser.username, content: formData.replyContent }] : [];
      const submissionData = { ...formData, ticketId: newTicketId, replies: initialReplies, editLogs: [], createdAt: new Date().toISOString(), isDeleted: false };
      
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'cs_records') : collection(db, 'cs_records'), submissionData);
      
      setSubmitStatus({ type: 'success', msg: `案件 ${newTicketId} 建立成功！` });
      setFormData(prev => ({
        ...getInitialForm(currentUser.username, channels, progresses),
        channel: (Array.isArray(channels) && channels.includes(prev.channel)) ? prev.channel : (channels[0] || ''),
        category: '', status: '',
        progress: (Array.isArray(progresses) && progresses.includes(prev.progress)) ? prev.progress : (progresses[0] || '待處理')
      }));
      setTimeout(() => setSubmitStatus({ type: '', msg: '' }), 4000);
    } catch (error) { setSubmitStatus({ type: 'error', msg: '儲存失敗。' }); }
  };

  const maintainTicketsList = useMemo(() => {
    if (!currentUser) return [];
    let result = tickets.filter(t => {
      if (t.isDeleted) return false;
      const matchSearch = debouncedMaintainSearchTerm ? ((t.ticketId || '').includes(debouncedMaintainSearchTerm) || (t.instName || '').includes(debouncedMaintainSearchTerm)) : true;
      if (currentUser.role === ROLES.ADMIN) return debouncedMaintainSearchTerm ? matchSearch : t.progress !== '結案'; 
      const isMine = t.receiver === currentUser.username || t.assignee === currentUser.username;
      const isUnresolved = t.progress !== '結案';
      return debouncedMaintainSearchTerm ? isMine && isUnresolved && matchSearch : isMine && isUnresolved;
    });
    result.sort((a, b) => maintainSortOrder === 'asc' ? new Date(a.receiveTime).getTime() - new Date(b.receiveTime).getTime() : new Date(b.receiveTime).getTime() - new Date(a.receiveTime).getTime());
    return result;
  }, [tickets, currentUser, debouncedMaintainSearchTerm, maintainSortOrder]);

  const openMaintainModal = (ticket) => {
    setMaintainModal(ticket);
    setMaintainForm({ progress: ticket.progress, assignee: ticket.assignee || '', newReply: '', extraInfo: ticket.extraInfo || '' });
  };

  const handleRequestDelete = async () => {
    const reason = window.prompt(`請輸入刪除案件「${maintainModal.instName || maintainModal.ticketId}」的申請原因：`);
    if (!reason) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', maintainModal.id) : doc(db, 'cs_records', maintainModal.id), { deleteRequest: { status: 'pending', reason: reason.trim(), requestedBy: currentUser.username, requestTime: getFormatDate() } });
      showToast('刪除申請已送出，待管理員簽核。'); setMaintainModal(null);
    } catch (error) { showToast("申請失敗：" + error.message, 'error'); }
  };

  const handleMaintainSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) return showToast("無權限", 'error');
    try {
      const updates = { progress: maintainForm.progress };
      if (maintainForm.progress === '結案' && maintainModal.progress !== '結案') updates.closeTime = getFormatDate();
      else if (maintainForm.progress !== '結案' && maintainModal.closeTime) updates.closeTime = '';
      updates.assignee = maintainForm.progress !== '結案' ? maintainForm.assignee : '';

      if (maintainForm.extraInfo !== maintainModal.extraInfo) {
        updates.extraInfo = maintainForm.extraInfo;
        updates.editLogs = [...(maintainModal.editLogs || []), { time: getFormatDate(), user: currentUser.username, oldContent: maintainModal.extraInfo, newContent: maintainForm.extraInfo, type: 'extraInfo_edit' }];
      }

      if (maintainForm.newReply.trim()) {
        const newReplyObj = { time: getFormatDate(), user: currentUser.username, content: maintainForm.newReply.trim() };
        updates.replies = [...(maintainModal.replies || []), newReplyObj];
        updates.replyContent = maintainForm.newReply.trim();
      }

      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', maintainModal.id) : doc(db, 'cs_records', maintainModal.id), updates);
      showToast('案件維護更新成功！');
      setMaintainModal(null);
    } catch (error) { showToast("更新失敗：" + error.message, 'error'); }
  };

  const handleModalSave = async () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', modalEditForm.id) : doc(db, 'cs_records', modalEditForm.id), modalEditForm);
      showToast('強制修改成功！'); setViewModalTicket(null); setIsEditingModal(false);
    } catch (error) { showToast('修改失敗：' + error.message, 'error'); }
  };

  const pendingDeleteRequests = useMemo(() => tickets.filter(t => !t.isDeleted && t.deleteRequest && t.deleteRequest.status === 'pending'), [tickets]);
  const allEditLogs = useMemo(() => {
    let logs = [];
    tickets.forEach(t => {
      if (t.isDeleted) return;
      if (Array.isArray(t.editLogs) && t.editLogs.length > 0) t.editLogs.forEach(log => logs.push({ ...log, ticketId: t.ticketId, instName: t.instName, recordId: t.id }));
    });
    return logs.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [tickets]);

  const handleApproveDelete = (ticketId, ticketInstName) => {
    showConfirm(`確定要【核准刪除】案件「${ticketInstName}」嗎？這將會進行邏輯刪除，並保留在紀錄資料區。`, async () => {
      try {
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', ticketId) : doc(db, 'cs_records', ticketId), {
          isDeleted: true,
          deletedAt: getFormatDate(),
          deletedBy: currentUser.username,
          'deleteRequest.status': 'approved'
        });
        showToast('已成功邏輯刪除該筆紀錄。');
      } catch (error) { showToast('刪除失敗：' + error.message, 'error'); }
    });
  };

  const handleRejectDelete = async (ticketId) => {
    const rejectReason = window.prompt('請輸入退回此刪除申請的理由：');
    if (rejectReason === null) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', ticketId) : doc(db, 'cs_records', ticketId), {
        'deleteRequest.status': 'rejected', 'deleteRequest.rejectReason': rejectReason.trim(), 'deleteRequest.rejectedBy': currentUser.username, 'deleteRequest.rejectTime': getFormatDate()
      });
      showToast('已退回該刪除申請。');
    } catch (error) { showToast('退回失敗：' + error.message, 'error');}
  };

  const handleBatchDeleteTickets = () => {
    if (currentUser?.role !== ROLES.ADMIN || selectedTickets.length === 0) return;
    showConfirm(`【警告】確定要刪除選取的 ${selectedTickets.length} 筆紀錄嗎？這將會標記為「已刪除」並保留於資料區。`, async () => {
      try {
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        let batch = writeBatch(db); let count = 0;
        for (let i = 0; i < selectedTickets.length; i++) {
          batch.update(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', selectedTickets[i]) : doc(db, 'cs_records', selectedTickets[i]), {
              isDeleted: true,
              deletedAt: getFormatDate(),
              deletedBy: currentUser.username
          });
          count++;
          if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
        if (count > 0) await batch.commit();
        setSelectedTickets([]); showToast(`成功邏輯刪除 ${selectedTickets.length} 筆紀錄。`);
      } catch (error) { showToast("批次刪除失敗：" + error.message, 'error'); }
    });
  };

  // 徹底刪除 (Hard Delete) 函式 (因為需要輸入 DELETE 防呆，這裡保留 prompt)
  const handleBatchHardDeleteTickets = async () => {
    if (currentUser?.role !== ROLES.ADMIN || selectedTickets.length === 0) return;
    const confirmText = window.prompt(`【危險操作 - 徹底刪除】\n您即將「永久刪除」 ${selectedTickets.length} 筆測試紀錄。\n此操作會從資料庫中完全抹除，無法復原且不留軌跡！\n\n請輸入大寫「DELETE」以確認執行：`);
    if (confirmText !== 'DELETE') {
      if (confirmText !== null) showToast('驗證碼不符，已取消徹底刪除操作。', 'error');
      return;
    }
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      let batch = writeBatch(db); let count = 0;
      for (let i = 0; i < selectedTickets.length; i++) {
        batch.delete(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', selectedTickets[i]) : doc(db, 'cs_records', selectedTickets[i]));
        count++;
        if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();
      setSelectedTickets([]); showToast(`成功徹底刪除 ${selectedTickets.length} 筆紀錄！`);
    } catch (error) { showToast("徹底刪除失敗：" + error.message, 'error'); }
  };

  const handleExportExcel = () => {
    if (!window.XLSX) return showToast("Excel 模組尚未載入完成，請稍後再試。", 'error');
    const targetData = activeTab === 'all-records' ? allRecordsFiltered : filteredAndSortedHistory;
    if (targetData.length === 0) return showToast("目前沒有資料可以匯出。", 'error');
    if (targetData.length > 5000) return showToast("為確保系統效能，單次匯出不可超過 5000 筆！請嘗試縮小範圍。", 'error');

    const exportData = targetData.map(t => ({
      '狀態標記': t.isDeleted ? '已刪除' : '正常',
      '案件號': t.ticketId || '', '接收時間(YYYY-MM-DD HH:mm)': t.receiveTime ? t.receiveTime.replace('T', ' ') : '',
      '反映管道': t.channel || '', '院所代碼': t.instCode ? String(t.instCode) + '\u200B' : '', '院所名稱': t.instName || '',
      '醫療層級': t.instLevel || '', '提問人資訊': t.questioner || '', '業務類別': t.category || '', '案件狀態': t.status || '',
      '處理進度': t.progress || '', '建檔人': t.receiver || '', '指定處理人': t.assignee || '', '詳細問題描述': t.extraInfo || '',
      '回覆內容(完整紀錄)': formatRepliesHistory(t.replies, t.replyContent), '結案時間(YYYY-MM-DD HH:mm)': t.closeTime ? t.closeTime.replace('T', ' ') : ''
    }));
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "客服紀錄匯出");
    window.XLSX.writeFile(wb, `客服紀錄匯出_${getToday().replace(/-/g, '')}.xlsx`);
    showToast('匯出成功！');
  };

  const handleDownloadTemplate = () => {
    if (!window.XLSX) return showToast("Excel 模組尚未載入完成，請稍後再試。", 'error');
    const headers = ['案件號', '接收時間(YYYY-MM-DD HH:mm)', '反映管道', '院所代碼', '院所名稱', '醫療層級', '提問人資訊', '業務類別', '案件狀態', '處理進度', '建檔人', '指定處理人', '詳細問題描述', '回覆內容(完整紀錄)', '結案時間(YYYY-MM-DD HH:mm)'];
    const ws = window.XLSX.utils.aoa_to_sheet([headers]); const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "匯入範本"); window.XLSX.writeFile(wb, "歷史紀錄匯入範本.xlsx");
  };

  const handleImportHistoryExcel = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX || currentUser?.role !== ROLES.ADMIN) return;
    setIsImportingHistory(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, defval: "" });
        const validRows = [];
        jsonData.forEach((row) => {
          const rawTime = row['接收時間(YYYY-MM-DD HH:mm)'] || row['接收時間'];
          if (rawTime && row['反映管道'] && row['業務類別'] && row['案件狀態'] && row['處理進度'] && row['建檔人']) validRows.push(row);
        });

        if (validRows.length > 5000) {
          showToast('單次匯入筆數超過 5000 筆！請將檔案拆分後再進行匯入。', 'error');
          return;
        }

        let added = 0; let batch = writeBatch(db); let count = 0;
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        for (const row of validRows) {
          let rTime = getFormatDate(); const rawRecTime = row['接收時間(YYYY-MM-DD HH:mm)'] || row['接收時間'];
          if (!isNaN(new Date(rawRecTime))) rTime = getFormatDate(new Date(rawRecTime));
          let cTime = ''; const rawCloseTime = row['結案時間(YYYY-MM-DD HH:mm)'] || row['結案時間'];
          if (rawCloseTime && !isNaN(new Date(rawCloseTime))) cTime = getFormatDate(new Date(rawCloseTime));
          const recordData = {
            ticketId: String(row['案件號'] || '').trim() || '歷史資料匯入', receiveTime: rTime, channel: String(row['反映管道']).trim(),
            instCode: String(row['院所代碼'] || '').replace('\u200B', '').trim(), instName: String(row['院所名稱'] || '').trim(),
            instLevel: String(row['醫療層級'] || '').trim(), questioner: String(row['提問人資訊'] || '').trim(),
            category: String(row['業務類別']).trim(), status: String(row['案件狀態']).trim(), progress: String(row['處理進度']).trim(),
            receiver: String(row['建檔人']).trim(), assignee: String(row['指定處理人'] || '').trim(), extraInfo: String(row['詳細問題描述'] || '').trim(),
            replyContent: String(row['回覆內容(完整紀錄)'] || row['回覆內容'] || '').trim(), closeTime: cTime, replies: [], createdAt: new Date().toISOString(), isImported: true, isDeleted: false
          };
          batch.set(baseDbPath.length ? doc(collection(db, ...baseDbPath, 'cs_records')) : doc(collection(db, 'cs_records')), recordData);
          count++; added++;
          if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
        }
        if (count > 0) await batch.commit();
        showToast(`成功匯入 ${added} 筆歷史紀錄！`);
      } catch (error) { showToast("匯入發生未預期錯誤，請確認檔案格式是否正確。", 'error'); } finally { setIsImportingHistory(false); e.target.value = null; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddInst = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN && currentUser?.role !== ROLES.USER) return;
    const paddedCode = newInst.code.trim().padStart(10, '0');
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'mohw_institutions') : collection(db, 'mohw_institutions'), { code: paddedCode, name: newInst.name, level: newInst.level });
      setNewInst({ code: '', name: '', level: '診所' }); showToast('院所單筆新增成功！');
    } catch (e) { showToast('新增失敗', 'error'); }
  };

  const handleDeleteInst = async (id) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
    await deleteDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'mohw_institutions', id) : doc(db, 'mohw_institutions', id));
  };

  const handleClearAllInsts = () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    showConfirm('確定要清空所有院所資料嗎？此操作不可逆！', async () => {
      setIsImporting(true);
      try {
        const batch = writeBatch(db);
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        institutions.forEach(inst => batch.delete(baseDbPath.length ? doc(db, ...baseDbPath, 'mohw_institutions', inst.id) : doc(db, 'mohw_institutions', inst.id)));
        await batch.commit();
        showToast('已清空所有院所資料');
      } catch (e) { showToast('清空失敗', 'error'); } finally { setIsImporting(false); }
    });
  };

  const handleFileUpload = async (e) => {
    if (currentUser?.role !== ROLES.ADMIN && currentUser?.role !== ROLES.USER) return;
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        const levelMapping = { '1': '醫學中心', '2': '區域醫院', '3': '地區醫院', '4': '診所', '5': '藥局', '6': '居家護理', '7': '康復之家', '8': '助產所', '9': '檢驗所', 'A': '物理治療所', 'B': '特約醫事放射機構', 'X': '不詳' };
        let currentChunk = [], chunks = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[1] || !row[3]) continue;
          const code = String(row[1]).trim().padStart(10, '0');
          if (instMap[code] && typeof instMap[code] !== 'boolean') continue; 
          const levelRaw = row[7] ? String(row[7]).trim().toUpperCase() : 'X';
          currentChunk.push({ code, name: String(row[3]).trim(), level: levelMapping[levelRaw] || '其他' });
          instMap[code] = true;
          if (currentChunk.length >= 4000) { chunks.push(currentChunk); currentChunk = []; }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);
        
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        for (const chunkData of chunks) {
          const batch = writeBatch(db);
          batch.set(baseDbPath.length ? doc(collection(db, ...baseDbPath, 'mohw_institutions')) : doc(collection(db, 'mohw_institutions')), { isChunk: true, payload: JSON.stringify(chunkData) });
          await batch.commit();
        }
        showToast('院所資料批次匯入完成！');
      } catch (error) { showToast('匯入失敗，請確認格式', 'error'); } finally { setIsImporting(false); e.target.value = null; }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredInsts = useMemo(() => institutions.filter(inst => (inst.code||'').includes(instSearchTerm) || (inst.name||'').includes(instSearchTerm)), [institutions, instSearchTerm]);

  const handleSort = (key) => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
  const handleCategoryClick = (cat) => { setHistoryStartDate(dashStartDate); setHistoryEndDate(dashEndDate); setSearchTerm(cat); setActiveTab('list'); };

  const filteredAndSortedHistory = useMemo(() => {
    let result = tickets.filter(t => {
      if (t.isDeleted) return false;
      const majorCat = categoryMapping[t.category] && categoryMapping[t.category].trim() !== '' ? categoryMapping[t.category].trim() : '未歸屬大類別';
      const matchSearch = debouncedSearchTerm === '' || (t.ticketId||'').includes(debouncedSearchTerm) || (t.instName||'').includes(debouncedSearchTerm) || (t.extraInfo||'').includes(debouncedSearchTerm) || (t.category||'').includes(debouncedSearchTerm) || majorCat.includes(debouncedSearchTerm) || (t.receiver||'').includes(debouncedSearchTerm);
      const matchProgress = historyProgress === '全部' || (historyProgress === '未結案' ? t.progress !== '結案' : t.progress === historyProgress);
      let matchDate = true;
      if (historyStartDate && historyEndDate) matchDate = t.receiveTime.slice(0, 10) >= historyStartDate && t.receiveTime.slice(0, 10) <= historyEndDate;
      return matchSearch && matchProgress && matchDate;
    });
    result.sort((a, b) => {
      let valA = sortConfig.key === 'receiveTime' ? new Date(a[sortConfig.key] || '').getTime() : (a[sortConfig.key] || '');
      let valB = sortConfig.key === 'receiveTime' ? new Date(b[sortConfig.key] || '').getTime() : (b[sortConfig.key] || '');
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [tickets, debouncedSearchTerm, historyStartDate, historyEndDate, historyProgress, sortConfig, categoryMapping]);

  const allRecordsFiltered = useMemo(() => {
    let result = tickets.filter(t => {
      if (!debouncedAllRecordsSearchTerm) return true;
      const majorCat = categoryMapping[t.category] && categoryMapping[t.category].trim() !== '' ? categoryMapping[t.category].trim() : '未歸屬大類別';
      return (t.ticketId||'').includes(debouncedAllRecordsSearchTerm) || (t.instName||'').includes(debouncedAllRecordsSearchTerm) || (t.extraInfo||'').includes(debouncedAllRecordsSearchTerm) || (t.category||'').includes(debouncedAllRecordsSearchTerm) || majorCat.includes(debouncedAllRecordsSearchTerm) || (t.receiver||'').includes(debouncedAllRecordsSearchTerm);
    });
    result.sort((a, b) => {
      let valA = sortConfig.key === 'receiveTime' ? new Date(a[sortConfig.key] || '').getTime() : (a[sortConfig.key] || '');
      let valB = sortConfig.key === 'receiveTime' ? new Date(b[sortConfig.key] || '').getTime() : (b[sortConfig.key] || '');
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [tickets, debouncedAllRecordsSearchTerm, sortConfig, categoryMapping]);

  const renderSortHeader = (label, sortKey, align = 'left', isFirst = false, isLast = false) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th className={`p-5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none ${align === 'center' ? 'text-center' : 'text-left'} ${isFirst ? 'rounded-tl-[2rem]' : ''} ${isLast ? 'rounded-tr-[2rem]' : ''}`} onClick={() => handleSort(sortKey)}>
        <div className={`flex items-center ${align === 'center' ? 'justify-center' : 'justify-start'} group`}>
          {label}
          <span className={`ml-1 flex flex-col ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400'}`}>
            {isActive ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <Menu size={14} />}
          </span>
        </div>
      </th>
    );
  };

const renderTicketTable = (data, currentPage, setCurrentPage) => {
  const PAGE_SIZE = 50;
  const paginatedData = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!paginatedData || paginatedData.length === 0) {
    return <tr><td colSpan="5" className="p-20 text-center text-slate-400 font-black text-lg">查無相關歷史紀錄</td></tr>;
  }

  return paginatedData.map(t => {
    // 決定大頭貼顯示誰 (優先顯示目前的負責人)
    const activeHandler = t.assignee || t.receiver || "系統自動";
    
    // 決定文字顯示邏輯 (A / B 或 C)
    const displayText = (t.assignee && t.assignee !== t.receiver) 
      ? `${t.receiver} / ${t.assignee}` 
      : (t.receiver || "系統自動");

    return (
      <tr key={t.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-50 dark:border-slate-700/50 group cursor-pointer" onClick={() => { setViewModalTicket(t); setModalEditForm({...t}); setIsEditingModal(false); }}>
        <td className="p-6 align-middle">
          <div className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">{t.ticketId}</div>
          <div className="text-xs font-bold text-slate-400 mt-1">{new Date(t.receiveTime).toLocaleDateString()}</div>
        </td>
        <td className="p-6 align-middle">
          <div className="font-black text-sm text-slate-700 dark:text-slate-200">{t.instName || '(無名稱)'}</div>
          <div className="text-xs font-mono text-slate-400 mt-1">{t.instCode}</div>
        </td>
        
        {/* ▼▼▼ 修改這裡：建檔人 / 處理人 ▼▼▼ */}
        <td className="p-6 align-middle">
          <div className="flex items-center space-x-3">
            <UserAvatar username={activeHandler} photoURL={userMap[activeHandler]?.photoURL} className="w-8 h-8" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {t.assignee && t.assignee !== t.receiver ? (
                <>
                  <span className="text-slate-400">{t.receiver}</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-blue-600 dark:text-blue-400">{t.assignee}</span>
                </>
              ) : (
                displayText
              )}
            </span>
          </div>
        </td>
        {/* ▲▲▲ 修改結束 ▲▲▲ */}

        <td className="p-6 align-middle">
          <span className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm ${t.progress === '結案' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
            {t.progress || '待處理'}
          </span>
        </td>
        <td className="p-6 align-middle text-center">
          <button className="p-3 bg-slate-50 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-600 rounded-full text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <Eye size={20}/>
          </button>
        </td>
      </tr>
    );
  });
};

  const dashboardStats = useMemo(() => {
    const total = tickets.filter(t => !t.isDeleted).length;
    const pending = tickets.filter(t => !t.isDeleted && t.progress !== '結案').length;
    const resolved = tickets.filter(t => !t.isDeleted && t.progress === '結案').length;
    const completionRate = total ? Math.round((resolved/total)*100) : 0;
    
    const startDateObj = new Date(`${dashStartDate}T00:00:00`);
    const endDateObj = new Date(`${dashEndDate}T23:59:59.999`);
    const rangeTickets = tickets.filter(t => !t.isDeleted && new Date(t.receiveTime) >= startDateObj && new Date(t.receiveTime) <= endDateObj);

    const personnelStartObj = new Date(`${personnelStartDate}T00:00:00`);
    const personnelEndObj = new Date(`${personnelEndDate}T23:59:59.999`);
    const personnelRangeTickets = tickets.filter(t => !t.isDeleted && new Date(t.receiveTime) >= personnelStartObj && new Date(t.receiveTime) <= personnelEndObj);

    const categoryData = {}; const aggregatedCategoryData = {};
    const safeCategories = Array.isArray(categories) ? categories : [];
    safeCategories.forEach(c => categoryData[c] = 0);
    
    const assigneeData = {};
    const regionData = {};

    rangeTickets.forEach(t => {
      if (safeCategories.includes(t.category)) categoryData[t.category] = (categoryData[t.category] || 0) + 1;
      else categoryData['已停用類別'] = (categoryData['已停用類別'] || 0) + 1;
    });

    personnelRangeTickets.forEach(t => {
      const effectiveAssignee = t.assignee || t.receiver;
      
      const role = userMap[effectiveAssignee]?.role;
      if (role === ROLES.USER) {
        assigneeData[effectiveAssignee] = (assigneeData[effectiveAssignee] || 0) + 1;
        const userRegion = userMap[effectiveAssignee]?.region || '未設定群組';
        regionData[userRegion] = (regionData[userRegion] || 0) + 1;
      }
    });

    Object.keys(categoryData).forEach(cat => {
      if(categoryData[cat] > 0 || Object.keys(categoryMapping).length > 0) { 
        const majorCat = categoryMapping[cat] && categoryMapping[cat].trim() !== '' ? categoryMapping[cat].trim() : '未歸屬大類別';
        aggregatedCategoryData[majorCat] = (aggregatedCategoryData[majorCat] || 0) + categoryData[cat];
      }
    });

    const monthLabels = [];
    for(let i=5; i>=0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }

    const trendData = { total: [], phone: [], line: [], phoneToLine: [] };
    monthLabels.forEach(monthStr => {
      const monthTickets = tickets.filter(t => !t.isDeleted && t.receiveTime.substring(0, 7) === monthStr && (trendCategory === '全類別' || t.category === trendCategory));
      trendData.total.push(monthTickets.length);
      trendData.phone.push(monthTickets.filter(t => t.channel === '電話').length);
      trendData.line.push(monthTickets.filter(t => t.channel === 'LINE').length);
      trendData.phoneToLine.push(monthTickets.filter(t => t.channel === '電話轉LINE').length);
    });

    return { total, pending, resolved, completionRate, categoryData, aggregatedCategoryData, trendData, monthLabels, assigneeData, regionData };
  }, [tickets, dashStartDate, dashEndDate, personnelStartDate, personnelEndDate, trendCategory, categories, categoryMapping, userMap]);


  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;

  if (!currentUser) {
    const isFirstTime = dbUsers.length === 0;
    
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-400 dark:bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10"></div>
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl z-10 w-full max-w-md border border-slate-100 dark:border-slate-700 flex flex-col relative">
          <div className="text-center mb-10">
            <div className="bg-blue-600 dark:bg-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 dark:shadow-none"><Shield size={32} className="text-white"/></div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">系統存取驗證</h2>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">{isFirstTime ? '初始化系統：建立最高管理員' : '請輸入您的帳號密碼'}</p>
            <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-600 font-mono font-bold tracking-widest">{APP_VERSION}</div>
          </div>
          <form onSubmit={isFirstTime ? handleCreateFirstAdmin : handleLogin} className="space-y-6">
            {isFirstTime ? (
              <>
                <div><label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-2 block">建立管理員帳號</label><input type="text" required value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-slate-400 dark:placeholder-slate-500" autoComplete="username"/></div>
                <div><label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-2 block">設定密碼</label><input type="password" required value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-slate-400 dark:placeholder-slate-500" autoComplete="new-password"/></div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-2 block">帳號</label>
                  <input type="text" required value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold placeholder-slate-400 dark:placeholder-slate-500" placeholder="請輸入帳號" autoComplete="username"/>
                </div>
                <div><label className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-2 block">密碼</label><input type="password" required value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder-slate-400 dark:placeholder-slate-500" autoComplete="current-password"/></div>
              </>
            )}
            {authError && <p className="text-sm text-red-500 dark:text-red-400 font-bold text-center animate-pulse">{authError}</p>}
            <button type="submit" className="w-full py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 flex justify-center items-center">{isFirstTime ? '初始化資料庫' : <><Lock size={16} className="mr-2"/> 登入系統</>}</button>
          </form>
        </div>
      </div>
    );
  }

  const renderNavButton = (id, Icon, label) => (
    <button 
      onClick={() => {
        setActiveTab(id);
        if (!isPinned && window.innerWidth < 1024) setIsSidebarOpen(false);
      }} 
      className={`flex items-center space-x-3 w-full px-4 py-3.5 rounded-xl transition-all duration-200 ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:bg-blue-500 dark:shadow-none' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-100'}`}
    >
      <Icon size={20} />
      <span className="font-bold text-sm tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      
      {/* Sidebar Wrapper */}
      <div className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 h-screen shrink-0 z-50 overflow-hidden ${isPinned ? 'w-64 relative' : `fixed w-64 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`} lg:relative lg:translate-x-0 lg:w-64 lg:shadow-none`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3"><div className="bg-blue-600 dark:bg-blue-500 text-white p-2.5 rounded-xl shadow-inner"><PhoneCall size={22} /></div><h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">客服中心</h1></div>
          <div className="flex items-center space-x-1 lg:hidden">
            <button onClick={() => setIsPinned(!isPinned)} className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Pin size={18} className={isPinned ? "" : "-rotate-45"} /></button>
            {!isPinned && <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={18} /></button>}
          </div>
        </div>
        <div className="px-6 py-4 flex items-center space-x-3 shrink-0"><UserAvatar username={activeUser.username} photoURL={activeUser.photoURL} className="w-10 h-10 text-sm" /><div><div className="font-bold text-sm dark:text-slate-200">{activeUser.username}</div><div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md inline-block mt-0.5">{activeUser.role}</div></div></div>
        <div className="px-6 pb-2 shrink-0">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
            <span className="flex items-center">{isDarkMode ? <Moon size={16} className="mr-2 text-indigo-400" /> : <Sun size={16} className="mr-2 text-amber-500" />}{isDarkMode ? '深色模式' : '淺色模式'}</span>
            <div className={`w-8 h-4 rounded-full flex items-center p-1 transition-colors ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-300'}`}><div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${isDarkMode ? 'translate-x-4' : ''}`} /></div>
          </button>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto border-t border-slate-100 dark:border-slate-700 mt-2 pt-4">
          {currentUser.role !== ROLES.VIEWER && <>{renderNavButton('form', Plus, '新增紀錄區')}{renderNavButton('maintenance', Edit, '紀錄維護區')}</>}
          {renderNavButton('list', List, '歷史查詢區')}
          {currentUser.role === ROLES.ADMIN && renderNavButton('all-records', Database, '紀錄資料區')}
          {renderNavButton('dashboard', LayoutDashboard, '進階統計區')}
          {currentUser.role === ROLES.ADMIN && renderNavButton('audit', FileText, '申請與日誌區')}
          {renderNavButton('settings', Settings, '系統設定區')}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0"><button onClick={handleLogout} className="w-full py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all">登出系統</button></div>
      </div>

      {!isPinned && isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative transition-colors duration-300 min-w-0">
        
        {!isPinned && (
          <div className="lg:hidden bg-white p-4 border-b border-slate-200 flex items-center shadow-sm sticky top-0 z-30 dark:bg-slate-800 dark:border-slate-700">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 mr-3 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none transition-colors"><Menu size={24} /></button>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center"><PhoneCall size={20} className="mr-2 text-blue-600 dark:text-blue-400" />客服紀錄系統</h1>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 w-full min-w-[320px]">
          
          {/* TAB 1: FORM */}
          {activeTab === 'form' && currentUser.role !== ROLES.VIEWER && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
              <div className="mb-8 flex justify-between items-end">
                <div><h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">新增紀錄區</h2><p className="text-sm text-slate-400 dark:text-slate-400 mt-2">以 <span className="font-bold text-blue-600 dark:text-blue-400">{currentUser.username}</span> 身份登錄。</p></div>
              </div>
              {submitStatus.msg && <div className={`p-4 rounded-2xl flex items-center space-x-3 border ${submitStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800'}`}><CheckCircle size={20}/><span className="font-bold">{submitStatus.msg}</span></div>}
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 dark:text-blue-400 tracking-wide uppercase text-sm"><User size={18} className="mr-2"/> 基本與院所資訊</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block">接收時間 <span className="text-red-500 dark:text-red-400">*</span></label>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, receiveTime: getFormatDate() }))} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><Clock size={12} className="mr-1"/> 設為現在</button>
                      </div>
                      <input type="datetime-local" name="receiveTime" required value={formData.receiveTime} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"/>
                    </div>
                    <div><label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">反映管道 <span className="text-red-500 dark:text-red-400">*</span></label><select name="channel" required value={formData.channel} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"><option value="" disabled>請選擇...</option>{(Array.isArray(channels)?channels:[]).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">提問人資訊</label><input type="text" name="questioner" value={formData.questioner} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="姓名 / 電話 / LINE"/></div>
                    <div className="md:col-span-1"><label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">院所代碼 (自動比對) <span className="text-red-500 dark:text-red-400">*</span></label><input type="text" name="instCode" required pattern="^(\d{10}|999)$" title="請輸入 10 碼數字，或填寫 999" value={formData.instCode} onChange={handleFormChange} onBlur={handleInstCodeBlur} className="w-full p-3.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-mono focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="輸入10碼後點擊空白處"/></div>
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest block mb-2">院所名稱與層級</label>
                      <div className="flex space-x-4">
                        <input type="text" name="instName" value={formData.instName} onChange={handleFormChange} readOnly={formData.instCode !== '999'} className={`w-2/3 p-3.5 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ${formData.instCode === '999' ? 'bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500' : 'bg-slate-50 dark:bg-slate-700/50 font-bold'}`} placeholder={formData.instCode === '999' ? "請自行輸入單位名稱" : "名稱"}/>
                        <input type="text" name="instLevel" value={formData.instLevel} readOnly className="w-1/3 p-3.5 border border-slate-200 dark:border-slate-600 rounded-2xl bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="層級"/>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 dark:text-blue-400 tracking-wide uppercase text-sm"><FileText size={18} className="mr-2"/> 案件內容與指派</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div><label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">類別 <span className="text-red-500 dark:text-red-400">*</span></label><select name="category" required value={formData.category} onChange={handleFormChange} className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"><option value="" disabled>請選擇...</option>{(Array.isArray(categories)?categories:[]).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">狀態 <span className="text-red-500 dark:text-red-400">*</span></label><select name="status" required value={formData.status} onChange={handleFormChange} className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"><option value="" disabled>請選擇...</option>{(Array.isArray(statuses)?statuses:[]).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">進度 <span className="text-red-500 dark:text-red-400">*</span></label><select name="progress" required value={formData.progress} onChange={handleFormChange} className={`w-full p-3 border border-slate-200 dark:border-slate-600 rounded-2xl font-black outline-none focus:ring-2 ${formData.progress === '結案' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 focus:ring-green-500' : formData.progress === '待處理' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 focus:ring-red-500' : formData.progress === '' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100' : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 focus:ring-orange-500'}`}><option value="" disabled>請選擇...</option>{(Array.isArray(progresses)?progresses:[]).map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                    {formData.progress !== '結案' && (
                      <div className="animate-in zoom-in-95 duration-200">
                        <label className="text-xs font-bold mb-2 block text-red-600 dark:text-red-400 flex items-center"><UserPlus size={14} className="mr-1"/> 指定處理人</label>
                        <select name="assignee" value={formData.assignee} onChange={handleFormChange} className="w-full p-3 border-2 border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-700 font-bold text-red-700 dark:text-red-400 rounded-2xl outline-none focus:border-red-500">
                          <option value="">-- 未指定 --</option>
                          {dbUsers.filter(u => u.role === ROLES.USER).map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold mb-2 block text-slate-700 dark:text-slate-300">詳細問題描述 <span className="text-red-500 dark:text-red-400">*</span></label>
                      <textarea name="extraInfo" required minLength="2" value={formData.extraInfo} onChange={handleFormChange} rows="4" className="w-full p-5 border border-slate-200 dark:border-slate-600 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" placeholder="請詳細描述客戶的問題..."></textarea>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold block text-slate-700 dark:text-slate-300">給予的初步答覆 <span className="text-red-500 dark:text-red-400">*</span></label>
                        <button type="button" onClick={() => setShowCannedModal(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><MessageSquare size={14} className="mr-1"/> 呼叫罐頭文字</button>
                      </div>
                      <textarea id="replyContent" name="replyContent" required minLength="2" value={formData.replyContent} onChange={handleFormChange} rows="4" className="w-full p-5 border border-slate-200 dark:border-slate-600 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30 dark:bg-blue-900/20 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" placeholder="給予的初步答覆..."></textarea>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 pb-12">
                  <button type="submit" disabled={submitStatus.type === 'loading' || currentUser.role === ROLES.VIEWER} className={`px-14 py-4 text-white rounded-[1.5rem] font-black flex items-center shadow-2xl transition-all ${currentUser.role === ROLES.VIEWER ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed' : 'bg-blue-600 dark:bg-blue-500 shadow-blue-200 dark:shadow-none hover:bg-blue-700 dark:hover:bg-blue-600 hover:-translate-y-1 active:scale-95'}`}>
                    {submitStatus.type === 'loading' ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div> : <Save size={22} className="mr-3"/>} 
                    {currentUser.role === ROLES.VIEWER ? '權限不足' : '儲存案件'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: MAINTENANCE (紀錄維護區) */}
          {activeTab === 'maintenance' && currentUser.role !== ROLES.VIEWER && (
             <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6 relative max-w-[1400px] mx-auto">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
                 <div>
                   <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight mb-2">紀錄維護區</h2>
                   <p className="text-sm text-slate-500 dark:text-slate-400">{currentUser.role === ROLES.ADMIN ? '管理員可查詢案件號以維護「已結案」紀錄。' : '僅顯示您負責或建檔的未結案紀錄。'}</p>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                   <select value={maintainSortOrder} onChange={(e) => setMaintainSortOrder(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                     <option value="asc">排序: 舊到新</option><option value="desc">排序: 新到舊</option>
                   </select>
                   <div className="relative w-full sm:w-80">
                     <Search size={18} className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500"/>
                     <input type="text" placeholder="輸入案件號碼查詢..." value={maintainSearchTerm} onChange={(e)=>setMaintainSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"/>
                   </div>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                 {maintainTicketsList.map(t => {
                   const isOverdue = t.progress !== '結案' && ((new Date().getTime() - new Date(t.receiveTime).getTime()) / 3600000) > overdueHours;
                   return (
                     <div key={t.id} onClick={() => openMaintainModal(t)} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all group flex flex-col h-full relative overflow-hidden">
                       <div className="absolute top-4 right-6 flex items-center space-x-2">
                         {isOverdue && <span className="animate-pulse bg-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black shadow-sm">逾期</span>}
                         <span className="text-[10px] font-mono text-slate-300 dark:text-slate-500">#{t.ticketId || t.id.slice(0,8)}</span>
                       </div>
                       <div className="flex justify-between items-start mb-4 mt-2">
                          <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${t.progress==='結案'?'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400':t.progress==='待處理'?'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400':'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'}`}>{t.progress}</span>
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">{new Date(t.receiveTime).toLocaleDateString()}</span>
                       </div>
                       <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">{t.instName || '無特定院所'}</h4>
                       <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">{t.extraInfo}</p>
                       <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs font-bold">
                         <div className="flex items-center text-slate-400 dark:text-slate-500"><UserAvatar username={t.receiver} photoURL={userMap[t.receiver]?.photoURL} className="w-5 h-5 text-[8px] mr-1.5" /><span>建檔</span></div>
                         {t.assignee && <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg"><UserAvatar username={t.assignee} photoURL={userMap[t.assignee]?.photoURL} className="w-4 h-4 text-[8px]" /><span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">負責</span></div>}
                       </div>
                     </div>
                   );
                 })}
                 {maintainTicketsList.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 font-bold text-lg">目前沒有符合條件的案件 🎉</div>}
               </div>

               {maintainModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
                   <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                     <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                       <h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100"><Edit size={20} className="mr-2 text-blue-600 dark:text-blue-400"/> 案件維護 - {maintainModal.instName}</h3>
                       <button onClick={() => setMaintainModal(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20}/></button>
                     </div>
                     <div className="p-8 overflow-y-auto flex-1 space-y-6">
                       <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                         <div className="flex justify-between mb-2">
                           <div className="text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">問題描述 (可修改)</div>
                           <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold">案件號: {maintainModal.ticketId || '舊案件'}</div>
                         </div>
                         <textarea value={maintainForm.extraInfo} onChange={e => setMaintainForm({...maintainForm, extraInfo: e.target.value})} rows="3" className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" placeholder="修改問題描述..."></textarea>
                         <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">提示：修改此處內容將會自動產生修改日誌，供管理員查核。</p>
                       </div>
                       
                       <div>
                         <div className="text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-3">答覆軌跡紀錄</div>
                         {maintainModal.replies && maintainModal.replies.length > 0 ? (
                           <div className="space-y-4">
                             {maintainModal.replies.map((r, i) => (
                               <div key={i} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-4 rounded-2xl shadow-sm flex items-start space-x-3">
                                 <UserAvatar username={r.user} photoURL={userMap[r.user]?.photoURL} className="w-8 h-8 text-xs shrink-0" />
                                 <div>
                                   <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{r.user} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal ml-2">{new Date(r.time).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
                                   <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{r.content}</div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         ) : maintainModal.replyContent ? (
                           <div className="relative flex items-start justify-end w-full pl-8 mb-6">
                             <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-5 rounded-2xl rounded-tr-sm shadow-sm w-full relative">
                               <div className="absolute top-4 -right-3.5 w-3 h-3 bg-blue-50 dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-800 rotate-45 transform border-b-transparent border-l-transparent"></div>
                               <div className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center"><Shield size={14} className="mr-1 text-blue-500 dark:text-blue-400"/> 歷史匯入紀錄</div>
                               <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{maintainModal.replyContent}</div>
                             </div>
                           </div>
                         ) : <div className="text-sm text-slate-400 dark:text-slate-500 italic">尚無任何答覆紀錄</div>}
                       </div>

                       <form id="maintain-form" onSubmit={handleMaintainSubmit} className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2 block">更新進度</label>
                             <select value={maintainForm.progress} onChange={e=>setMaintainForm({...maintainForm, progress:e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-2 font-bold outline-none">
                               {(Array.isArray(progresses)?progresses:[]).map(p=><option key={p} value={p}>{p}</option>)}
                             </select>
                           </div>
                           {maintainForm.progress !== '結案' ? (
                             <div>
                               <label className="text-xs font-black text-red-600 dark:text-red-400 mb-2 block">指派後續處理人</label>
                               <select value={maintainForm.assignee} onChange={e=>setMaintainForm({...maintainForm, assignee:e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border-2 border-red-200 dark:border-red-900/50 rounded-xl font-bold text-red-700 dark:text-red-400 outline-none">
                                 <option value="">-- 未指定 --</option>
                                 {dbUsers.filter(u => u.role === ROLES.USER).map(u=><option key={u.id} value={u.username}>{u.username}</option>)}
                               </select>
                             </div>
                           ) : <div className="opacity-50"><label className="text-xs font-black text-slate-400 dark:text-slate-500 mb-2 block">處理人</label><input disabled value={maintainForm.assignee || '自動清除指派'} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl"/></div>}
                         </div>
                         <div>
                           <div className="flex justify-between items-end mb-2">
                             <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">追加新答覆 / 註記</label>
                             <button type="button" onClick={() => setShowCannedModal(true)} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><MessageSquare size={14} className="mr-1"/> 呼叫罐頭文字</button>
                           </div>
                           <textarea value={maintainForm.newReply} onChange={e=>setMaintainForm({...maintainForm, newReply:e.target.value})} rows="4" className="w-full p-4 bg-blue-50/30 dark:bg-blue-900/20 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-500" placeholder="輸入新的答覆，或點擊上方按鈕複製罐頭文字貼上..."></textarea>
                         </div>
                       </form>
                     </div>
                     <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
                       <button onClick={handleRequestDelete} className="px-4 py-3 text-red-500 dark:text-red-400 font-bold hover:bg-red-50 dark:bg-red-900/30 rounded-xl transition-colors text-sm flex items-center"><Trash2 size={16} className="mr-1" /> 申請刪除</button>
                       <div>
                         <button onClick={()=>setMaintainModal(null)} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl mr-3 transition-colors">取消</button>
                         <button form="maintain-form" type="submit" disabled={currentUser.role === ROLES.VIEWER} className={`px-8 py-3 text-white rounded-xl font-black shadow-lg transition-all ${currentUser.role === ROLES.VIEWER ? 'bg-slate-400 dark:bg-slate-600' : 'bg-blue-600 dark:bg-blue-500 shadow-blue-200 dark:shadow-none hover:bg-blue-700 dark:hover:bg-blue-600 hover:-translate-y-0.5'}`}>{currentUser.role === ROLES.VIEWER ? '無維護權限' : '確認更新並寫入軌跡'}</button>
                       </div>
                     </div>
                   </div>
                 </div>
               )}
             </div>
          )}

{/* TAB: 歷史查詢 (寬版優化版) */}
          {activeTab === 'list' && (
            <div className="space-y-6 animate-in fade-in duration-500 w-full px-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight shrink-0">紀錄資料區</h2>
              {/* 頂部搜尋與工具列 (寬版) */}
              <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm w-full">
                <div className="relative flex-1 min-w-[300px]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input 
                    type="text" 
                    placeholder="搜尋案號、院所或內容..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                   <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] font-bold dark:text-white outline-none" />
                   <span className="font-black text-slate-400">至</span>
                   <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] font-bold dark:text-white outline-none" />
                   <select value={historyProgress} onChange={e => setHistoryProgress(e.target.value)} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] font-bold dark:text-white outline-none">
                      <option value="全部">全部進度</option>
                      {progresses.map(p => <option key={p} value={p}>{p}</option>)}
                   </select>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleExportExcel} className="px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-[1.5rem] font-black shadow-lg flex items-center transition-all active:scale-95">
                    <Download size={18} className="mr-2"/> 匯出
                  </button>
                  <button className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black shadow-lg flex items-center transition-all active:scale-95">
                    <Upload size={18} className="mr-2"/> 匯入
                  </button>
                </div>
              </div>

              {/* 寬版表格容器 */}
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                      <tr>
                        <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">案號 / 日期</th>
                        <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">院所與代碼</th>
                        <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">建檔/處理同仁</th>
                        <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">當前狀態</th>
                        <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {renderTicketTable(filteredAndSortedHistory, historyPage, setHistoryPage)}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={historyPage} totalCount={filteredAndSortedHistory.length} pageSize={ITEMS_PER_PAGE} onPageChange={setHistoryPage} />
              </div>
            </div>
          )}

          {/* TAB 6: ALL RECORDS (紀錄資料區) */}
          {activeTab === 'all-records' && currentUser.role === ROLES.ADMIN && (
             <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6 max-w-[1400px] mx-auto">
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                 <div>
                   <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight shrink-0">紀錄資料區</h2>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">顯示資料庫中所有原始紀錄（不過濾任何條件），方便檢視與批次操作。</p>
                 </div>
                 <div className="flex flex-col md:flex-row w-full xl:w-auto gap-3">
                   {selectedTickets.length > 0 && (
                     <>
                       <button onClick={handleBatchDeleteTickets} className="flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-red-700 transition-colors font-bold text-sm shrink-0 animate-in fade-in" title="標記為已刪除，保留於系統軌跡"><Trash2 size={16} /><span className="hidden md:inline">邏輯刪除 ({selectedTickets.length})</span></button>
                       <button onClick={handleBatchHardDeleteTickets} className="flex items-center justify-center space-x-2 bg-slate-900 dark:bg-black text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-slate-700 transition-colors font-bold text-sm shrink-0 animate-in fade-in" title="從資料庫徹底抹除，不留任何軌跡"><X size={16} /><span className="hidden md:inline">徹底刪除 ({selectedTickets.length})</span></button>
                     </>
                   )}
                   <button onClick={handleExportExcel} className="flex items-center justify-center space-x-2 bg-green-600 dark:bg-green-500 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-bold text-sm shrink-0"><Download size={16} /><span className="hidden md:inline">匯出全部</span></button>
                   <div className="relative flex-1 xl:w-72">
                     <Search size={18} className="absolute left-4 top-3 text-slate-400 dark:text-slate-500"/>
                     <input type="text" placeholder="關鍵字搜尋..." value={allRecordsSearchTerm} onChange={(e)=>setAllRecordsSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"/>
                   </div>
                 </div>
               </div>
               
               {renderTicketTable(allRecordsFiltered, allRecordsPage, setAllRecordsPage)}
             </div>
          )}

          {/* TAB 7: AUDIT (申請與日誌區 - Admin Only) */}
          {activeTab === 'audit' && currentUser.role === ROLES.ADMIN && (
             <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
               <div>
                 <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight shrink-0">申請與日誌區</h2>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">供管理員簽核刪除申請，以及查閱全系統的問題描述修改紀錄。</p>
               </div>
               
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col max-h-[800px]">
                   <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100">
                     <AlertCircle size={20} className="mr-2 text-red-600 dark:text-red-400"/> 待處理刪除申請
                     {pendingDeleteRequests.length > 0 && <span className="ml-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2.5 py-0.5 rounded-full text-xs font-bold">{pendingDeleteRequests.length} 件</span>}
                   </h3>
                   <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                     {pendingDeleteRequests.length === 0 ? (
                       <div className="h-40 flex items-center justify-center text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">目前無待簽核的刪除申請。</div>
                     ) : (
                       pendingDeleteRequests.map(t => (
                         <div key={t.id} className="bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-5 rounded-2xl shadow-sm">
                           <div className="flex justify-between items-start mb-2"><div className="font-black text-slate-800 dark:text-slate-200 text-sm">#{t.ticketId} - {t.instName}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{t.deleteRequest.requestTime}</div></div>
                           <div className="text-sm text-slate-700 dark:text-slate-300 mb-4 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700"><span className="font-bold text-red-600 dark:text-red-400 mr-2">申請原因:</span>{t.deleteRequest.reason}</div>
                           <div className="flex justify-between items-center text-xs">
                             <div className="flex items-center font-bold text-slate-500 dark:text-slate-400">申請人: <UserAvatar username={t.deleteRequest.requestedBy} photoURL={userMap[t.deleteRequest.requestedBy]?.photoURL} className="w-5 h-5 text-[8px] mx-1.5" /> {t.deleteRequest.requestedBy}</div>
                             <div className="space-x-2">
                               <button onClick={() => handleRejectDelete(t.id)} className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg font-bold transition-colors">退回</button>
                               <button onClick={() => handleApproveDelete(t.id, t.instName)} className="px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 rounded-lg font-bold shadow-sm transition-colors">核准刪除</button>
                             </div>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>

                 <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col max-h-[800px]">
                   <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><FileText size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 原始內容修改日誌</h3>
                   <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                     {allEditLogs.length === 0 ? (
                       <div className="h-40 flex items-center justify-center text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">尚無任何修改紀錄。</div>
                     ) : (
                       allEditLogs.map((log, idx) => (
                         <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 p-5 rounded-2xl shadow-sm">
                           <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-600 pb-2"><div className="font-black text-indigo-800 dark:text-indigo-300 text-xs">#{log.ticketId} - {log.instName}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{log.time}</div></div>
                           <div className="space-y-3">
                             <div><div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">修改前原內容</div><div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded line-through decoration-red-400 dark:decoration-red-500 border border-slate-200 dark:border-slate-700">{log.oldContent || '(空)'}</div></div>
                             <div><div className="text-[10px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-1">修改後新內容</div><div className="text-xs text-slate-800 dark:text-slate-200 bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded border border-indigo-100 dark:border-indigo-800">{log.newContent || '(空)'}</div></div>
                           </div>
                           <div className="mt-3 flex justify-end items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">修改人: <UserAvatar username={log.user} photoURL={userMap[log.user]?.photoURL} className="w-4 h-4 text-[6px] mx-1" /> <span className="text-indigo-600 dark:text-indigo-400">{log.user}</span></div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
               </div>
             </div>
          )}

          {/* TAB 4: DASHBOARD (統計報表) */}
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">進階統計區</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-black text-left mb-6">總件數</div>
                  <div className="text-5xl md:text-6xl font-black text-slate-900 dark:text-slate-50 leading-none text-right">{dashboardStats.total}</div>
                </div>
                <div onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); setHistoryProgress('未結案'); setSearchTerm(''); setActiveTab('list'); }} className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between cursor-pointer hover:border-red-300 dark:hover:border-red-500 hover:shadow-md transition-all group" title="點擊檢視所有待處理案件">
                  <div className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-black text-left mb-6 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors flex justify-between items-center">待處理件數<ArrowRight className="opacity-0 group-hover:opacity-100 text-red-500 dark:text-red-400 transition-opacity" size={24} /></div>
                  <div className="text-5xl md:text-6xl font-black text-red-500 dark:text-red-400 leading-none text-right group-hover:scale-105 transform origin-right transition-transform">{dashboardStats.pending}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div className="text-slate-500 dark:text-slate-400 text-xl md:text-2xl font-black text-left mb-6">完成率</div>
                  <div className="text-5xl md:text-6xl font-black text-blue-600 dark:text-blue-400 leading-none text-right">{dashboardStats.completionRate}%</div>
                </div>
              </div>

              {/* 圖表區 1: 垂直長條圖 (自訂區間) */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <div className="flex items-center space-x-4">
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">服務類別分佈</h3>
                      <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setCategoryViewMode('detail')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${categoryViewMode === 'detail' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>細項類別</button>
                        <button onClick={() => setCategoryViewMode('major')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${categoryViewMode === 'major' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>大類別彙整</button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">點擊長條圖可直接跳轉至歷史查詢區檢視該分類資料</p>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-600">
                    <Calendar size={16} className="text-slate-400 dark:text-slate-400 ml-2"/>
                    <input type="date" value={dashStartDate} onChange={e=>setDashStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"/>
                    <span className="text-slate-300 dark:text-slate-500">~</span>
                    <input type="date" value={dashEndDate} onChange={e=>setDashEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer mr-2 [color-scheme:light] dark:[color-scheme:dark]"/>
                  </div>
                </div>
                
                {categoryViewMode === 'major' && Object.keys(dashboardStats.aggregatedCategoryData).length === 0 ? (
                  <div className="h-[320px] flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-700/30 rounded-2xl mt-4">目前無大類別資料，請至「系統設定區」進行歸屬設定。</div>
                ) : (
                  <div className="flex h-[320px] items-end space-x-4 md:space-x-8 overflow-x-auto pb-4 pt-12 px-4">
                    {Object.entries(categoryViewMode === 'detail' ? dashboardStats.categoryData : dashboardStats.aggregatedCategoryData).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => {
                        const currentData = categoryViewMode === 'detail' ? dashboardStats.categoryData : dashboardStats.aggregatedCategoryData;
                        const maxVal = Math.max(...Object.values(currentData), 1);
                        const heightPct = (count / maxVal) * 100;
                        const barColorClass = categoryViewMode === 'detail' ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-blue-500 dark:bg-blue-400';
                        const textColorClass = categoryViewMode === 'detail' ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'group-hover:text-blue-600 dark:group-hover:text-blue-400';
                        return (
                          <div key={cat} onClick={() => handleCategoryClick(cat)} title="點擊查看此分類歷史紀錄" className="group flex flex-col items-center justify-end h-full w-12 shrink-0 relative animate-in fade-in duration-500 cursor-pointer">
                            <div className="absolute -top-8 text-slate-900 dark:text-slate-800 bg-slate-100 dark:bg-slate-200 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap z-10 shadow-sm transition-transform transform group-hover:-translate-y-1">{count} 件</div>
                            <div className="w-10 bg-slate-100 dark:bg-slate-700 rounded-t-full h-full flex flex-col justify-end overflow-hidden relative group-hover:shadow-inner"><div className={`w-full ${barColorClass} rounded-t-full transition-all duration-1000 ease-out group-hover:brightness-110`} style={{ height: `${heightPct}%` }}></div></div>
                            <div className={`text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-4 h-32 text-center leading-tight [writing-mode:vertical-rl] transition-colors tracking-widest select-none ${textColorClass}`}>{cat}</div>
                          </div>
                        );
                    })}
                  </div>
                )}
              </div>

              {/* 圖表區 2: 負責人與地區分佈 (切換直條圖) */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <div className="flex items-center space-x-4">
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">案件處理人員統計</h3>
                      <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        <button onClick={() => setPersonnelViewMode('assignee')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${personnelViewMode === 'assignee' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>處理人員</button>
                        <button onClick={() => setPersonnelViewMode('region')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${personnelViewMode === 'region' ? 'bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>群組</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-600">
                    <Calendar size={16} className="text-slate-400 dark:text-slate-400 ml-2"/>
                    <input type="date" value={personnelStartDate} onChange={e=>setPersonnelStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"/>
                    <span className="text-slate-300 dark:text-slate-500">~</span>
                    <input type="date" value={personnelEndDate} onChange={e=>setPersonnelEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer mr-2 [color-scheme:light] dark:[color-scheme:dark]"/>
                  </div>
                </div>
                
                {Object.keys(personnelViewMode === 'assignee' ? dashboardStats.assigneeData : dashboardStats.regionData).length === 0 ? (
                  <div className="h-[320px] flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-700/30 rounded-2xl mt-4">目前無相關資料。</div>
                ) : (
                  <div className="flex h-[320px] items-end space-x-4 md:space-x-8 overflow-x-auto pb-4 pt-12 px-4">
                    {Object.entries(personnelViewMode === 'assignee' ? dashboardStats.assigneeData : dashboardStats.regionData).sort((a,b)=>b[1]-a[1]).map(([key, count]) => {
                        const currentData = personnelViewMode === 'assignee' ? dashboardStats.assigneeData : dashboardStats.regionData;
                        const maxVal = Math.max(...Object.values(currentData), 1);
                        const heightPct = (count / maxVal) * 100;
                        const barColorClass = personnelViewMode === 'assignee' ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-emerald-500 dark:bg-emerald-400';
                        const textColorClass = personnelViewMode === 'assignee' ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400';
                        return (
                          <div key={key} className="group flex flex-col items-center justify-end h-full w-12 shrink-0 relative animate-in fade-in duration-500">
                            <div className="absolute -top-8 text-slate-900 dark:text-slate-800 bg-slate-100 dark:bg-slate-200 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap z-10 shadow-sm transition-transform transform group-hover:-translate-y-1">{count} 件</div>
                            <div className="w-10 bg-slate-100 dark:bg-slate-700 rounded-t-full h-full flex flex-col justify-end overflow-hidden relative group-hover:shadow-inner"><div className={`w-full ${barColorClass} rounded-t-full transition-all duration-1000 ease-out group-hover:brightness-110`} style={{ height: `${heightPct}%` }}></div></div>
                            <div className={`text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-4 h-32 text-center leading-tight [writing-mode:vertical-rl] transition-colors tracking-widest select-none ${textColorClass}`}>{key}</div>
                          </div>
                        );
                    })}
                  </div>
                )}
              </div>

              {/* 圖表區 3: 線型圖 (月趨勢) */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">近半年趨勢走勢圖</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">觀測各類別每月份案件數量波動</p>
                  </div>
                  <select value={trendCategory} onChange={e=>setTrendCategory(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="全類別">-- 綜合全類別 --</option>
                    {(Array.isArray(categories)?categories:[]).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <LineChart 
                  datasets={[
                    { label: '總計', data: dashboardStats.trendData.total, color: '#94a3b8', dashed: true },
                    { label: '電話', data: dashboardStats.trendData.phone, color: '#3b82f6' },
                    { label: 'LINE', data: dashboardStats.trendData.line, color: '#10b981' },
                    { label: '電話轉LINE', data: dashboardStats.trendData.phoneToLine, color: '#f59e0b' }
                  ]} 
                  labels={dashboardStats.monthLabels.map(m => m.replace('-','/'))} 
                  isDarkMode={isDarkMode} 
                />
              </div>

            </div>
          )}

          {/* TAB 5: SETTINGS (系統設定區) */}
          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">系統設定區</h2>
                {currentUser.role === ROLES.ADMIN && (
                  <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <button onClick={() => setSettingsTab('general')} className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center ${settingsTab === 'general' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}><User size={16} className="mr-2"/>一般設定</button>
                    <button onClick={() => setSettingsTab('system')} className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center ${settingsTab === 'system' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}><Settings size={16} className="mr-2"/>系統參數設定</button>
                  </div>
                )}
              </div>

              {(settingsTab === 'general' || currentUser.role !== ROLES.ADMIN) && (
                <>
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><User size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 個人帳號設定</h3>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="flex flex-col items-center space-y-4 p-6 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] bg-slate-50 dark:bg-slate-700/30 shrink-0 w-full md:w-48">
                        <UserAvatar username={activeUser.username} photoURL={activeUser.photoURL} className="w-20 h-20 text-3xl" />
                        <label className="cursor-pointer flex items-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors w-full justify-center">
                          <Camera size={14} className="mr-1.5"/> 更換個人圖像
                          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        </label>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center leading-tight">建議上傳正方形圖片<br/>(系統會自動壓縮)</p>
                      </div>

                      <form onSubmit={handleChangeOwnPassword} className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div>
                          <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">新密碼</label>
                          <input type="password" required value={pwdChangeForm.newPwd} onChange={e=>setPwdChangeForm({...pwdChangeForm, newPwd: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="輸入新密碼"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">確認新密碼</label>
                          <input type="password" required value={pwdChangeForm.confirmPwd} onChange={e=>setPwdChangeForm({...pwdChangeForm, confirmPwd: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="再次輸入新密碼"/>
                        </div>
                        <div className="md:col-span-2">
                          <button type="submit" className="w-full md:w-auto px-10 py-4 bg-slate-800 dark:bg-slate-600 text-white rounded-2xl font-black hover:bg-black dark:hover:bg-slate-500 transition-all shadow-lg active:scale-95">更新密碼</button>
                          {pwdChangeMsg && <p className={`mt-4 text-sm font-bold ${pwdChangeMsg.includes('❌') ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-green-600 dark:text-green-400'}`}>{pwdChangeMsg}</p>}
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm mb-8 mt-8">
                    <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><UserPlus size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 請假與代理人設定</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">當您設定了休假區間與代理人後，在該區間內，系統會自動將您的逾期案件推播轉發給代理人。</p>
                    <form onSubmit={handleSaveLeave} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end bg-slate-50 dark:bg-slate-700/30 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                      <div>
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">請假開始日期</label>
                        <input type="date" value={leaveForm.start} onChange={e=>setLeaveForm({...leaveForm, start: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">請假結束日期</label>
                        <input type="date" value={leaveForm.end} onChange={e=>setLeaveForm({...leaveForm, end: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">選擇代理人</label>
                        <select value={leaveForm.delegate} onChange={e=>setLeaveForm({...leaveForm, delegate: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                          <option value="">-- 無代理人 --</option>
                          {dbUsers.filter(u => u.username !== activeUser?.username && u.role === ROLES.USER).map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                        </select>
                      </div>
                      <div className="flex space-x-3">
                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-md active:scale-95 text-sm">儲存代理</button>
                        <button type="button" onClick={handleClearLeave} className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 text-sm shadow-sm">清除</button>
                      </div>
                    </form>
                  </div>

                  {currentUser.role !== ROLES.VIEWER && (
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
                      <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><MessageSquare size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 罐頭文字維護</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">新增的文字將自動顯示在所有人的「新增紀錄」與「紀錄維護」彈窗面板中。</p>
                      <DropdownManager title="常用回覆範本" dbKey="cannedMessages" items={cannedMessages} showToast={showToast} showConfirm={showConfirm} />
                    </div>
                  )}
                </>
              )}

              {settingsTab === 'system' && currentUser.role === ROLES.ADMIN && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
                  {/* System Parameters (Overdue Hours & Manual Trigger) */}
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><Timer size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 系統逾期參數設定</h3>
                    <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">逾期判定時數 (小時)：</label>
                      <input type="number" min="1" value={overdueHours} onChange={e => setOverdueHours(Number(e.target.value))} className="w-full md:w-32 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
                      <button onClick={handleSaveOverdueHours} className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black text-sm transition-all">儲存參數</button>
                      <button onClick={handleManualTrigger} disabled={isTriggering} className="w-full md:w-auto px-6 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-md font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center">
                        {isTriggering ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> : null}
                        強制觸發推播
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">設定後，維護區內未結案且超過此時數的案件，將會顯示閃爍紅色的「逾期」提示標籤。</p>
                  </div>

                  {/* Holidays Management */}
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><Calendar size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 國定假日與停發推播區間</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">設定的期間內，系統不會自動發送推播通知，並且在計算案件逾期時數時會「自動扣除」這些天數（不影響手手動強制推播）。</p>
                    
                    <form onSubmit={handleAddHoliday} className="flex flex-col md:flex-row gap-4 items-end mb-8 bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">開始日期</label>
                        <input type="date" required value={newHoliday.start} onChange={e=>setNewHoliday({...newHoliday, start: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none [color-scheme:light] dark:[color-scheme:dark]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">結束日期</label>
                        <input type="date" required value={newHoliday.end} onChange={e=>setNewHoliday({...newHoliday, end: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none [color-scheme:light] dark:[color-scheme:dark]" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-2">休假事由</label>
                        <input type="text" required value={newHoliday.note} onChange={e=>setNewHoliday({...newHoliday, note: e.target.value})} placeholder="例如: 中秋連假" className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black shadow-md shrink-0">新增假期</button>
                    </form>

                    <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-[1.5rem] bg-white dark:bg-slate-800 max-h-[300px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 text-[10px] font-black uppercase text-slate-500 tracking-widest z-10">
                          <tr><th className="p-4">開始日期</th><th className="p-4">結束日期</th><th className="p-4">事由</th><th className="p-4 text-center">刪除</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm font-medium">
                          {holidays.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold">目前無設定任何國定假日</td></tr> : holidays.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-mono text-slate-600 dark:text-slate-300">{h.start}</td>
                              <td className="p-4 font-mono text-slate-600 dark:text-slate-300">{h.end}</td>
                              <td className="p-4 text-slate-800 dark:text-slate-200 font-bold">{h.note}</td>
                              <td className="p-4 text-center"><button onClick={()=>handleRemoveHoliday(idx)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Users Management */}
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><Shield size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 使用者與權限管理</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                        <h4 className="font-bold text-sm mb-4 dark:text-slate-200">建立新用戶</h4>
                        <form onSubmit={handleAddUser} className="space-y-4">
                          <input type="text" required placeholder="設定帳號 (將顯示為負責人)" value={newUser.username} onChange={e=>setNewUser({...newUser, username:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl font-medium outline-none"/>
                          <input type="password" required placeholder="設定初始密碼" value={newUser.password} onChange={e=>setNewUser({...newUser, password:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl font-medium outline-none"/>
                          <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold outline-none">
                            <option value={ROLES.USER}>{ROLES.USER} (可新增/維護紀錄)</option>
                            <option value={ROLES.VIEWER}>{ROLES.VIEWER} (僅能看不可改)</option>
                            <option value={ROLES.ADMIN}>{ROLES.ADMIN} (系統全權限)</option>
                          </select>
                          <input type="text" placeholder="綁定 LINE UID (U開頭... 非必填)" value={newUser.lineUserId || ''} onChange={e=>setNewUser({...newUser, lineUserId:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl font-medium outline-none"/>
                          <button type="submit" className="w-full py-3.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-black hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-md">新增用戶</button>
                        </form>
                      </div>
                      <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-[1.5rem] bg-white dark:bg-slate-800 h-[320px]">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest z-10">
                            <tr><th className="p-4">帳號/頭像</th><th className="p-4">權限</th><th className="p-4">群組歸屬</th><th className="p-4">LINE UID (修改後點空白)</th><th className="p-4 text-center">刪除</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm font-medium">
                            {(Array.isArray(dbUsers)?dbUsers:[]).map(u => (
                              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4 flex items-center space-x-3 dark:text-slate-200"><UserAvatar username={u.username} photoURL={u.photoURL} className="w-8 h-8 text-xs shrink-0" /><span>{u.username}</span></td>
                                <td className="p-4"><span className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs">{u.role}</span></td>
                                <td className="p-4">
                                  {u.role === ROLES.USER ? (
                                    <input 
                                      type="text" 
                                      defaultValue={u.region || ''} 
                                      onBlur={(e) => handleUpdateUserRegion(u.id, e.target.value)} 
                                      placeholder="輸入群組..." 
                                      className="w-full min-w-[80px] p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                                    />
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 text-xs italic font-bold">不適用</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  {u.role === ROLES.USER ? (
                                    <input 
                                      type="text" 
                                      defaultValue={u.lineUserId || ''} 
                                      onBlur={(e) => handleUpdateUserLineId(u.id, e.target.value)} 
                                      placeholder="輸入 LINE UID..." 
                                      className="w-full min-w-[120px] p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono"
                                    />
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 text-xs italic font-bold">不適用</span>
                                  )}
                                </td>
                                <td className="p-4 text-center">{u.id !== currentUser.id && <button onClick={()=>handleDeleteUser(u.id)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Insts */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-8">
                      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-black mb-6 text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center"><Plus size={18} className="mr-2 text-blue-600 dark:text-blue-400"/> 單筆新增院所</h3>
                        <form onSubmit={handleAddInst} className="space-y-4">
                          <input type="text" placeholder="代碼" value={newInst.code} onChange={e=>setNewInst({...newInst, code:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl font-medium focus:ring-2 outline-none"/>
                          <input type="text" placeholder="名稱" value={newInst.name} onChange={e=>setNewInst({...newInst, name:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl font-medium focus:ring-2 outline-none"/>
                          <button type="submit" className="w-full py-4 bg-slate-800 dark:bg-slate-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black dark:hover:bg-slate-500 transition-colors">單筆存入</button>
                        </form>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-black mb-2 text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center"><Upload size={18} className="mr-2 text-green-600 dark:text-green-400"/> 批次匯入 (Excel)</h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-6 font-bold">自動擷取 B 欄、D 欄、H 欄</p>
                        <div className="relative">
                          <input type="file" onChange={handleFileUpload} disabled={isImporting} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"/>
                          <button disabled={isImporting} className="w-full py-4 bg-green-600 dark:bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center hover:bg-green-700 dark:hover:bg-green-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 transition-colors">
                            {isImporting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div> : <Upload size={18} className="mr-2"/>} 開始匯入
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm h-[700px] flex flex-col">
                      <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center px-8">
                        <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-widest">雲端院所對照表 ({(Array.isArray(institutions)?institutions:[]).length.toLocaleString()} 筆)</h3>
                        {(Array.isArray(institutions)?institutions:[]).length > 0 && <button onClick={handleClearAllInsts} className="text-red-400 text-xs font-black uppercase tracking-tighter hover:text-red-600">清空全部資料庫</button>}
                      </div>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                            <tr><th className="p-5">代碼</th><th className="p-5">名稱</th><th className="p-5 text-center">刪除</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs font-medium">
                            {(Array.isArray(filteredInsts)?filteredInsts:[]).slice(0, 100).map(i=>(
                              <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="p-5 font-mono text-slate-500 dark:text-slate-400">{i.code}</td>
                                <td className="p-5 text-slate-800 dark:text-slate-200 font-bold">{i.name}</td>
                                <td className="p-5 text-center"><button onClick={()=>handleDeleteInst(i.id)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={16}/></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Dropdowns */}
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
                    <h3 className="font-black text-lg mb-2 flex items-center text-slate-800 dark:text-slate-100"><List size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 表單下拉選單維護</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-bold flex items-center"><AlertCircle size={14} className="mr-1 text-orange-500 dark:text-orange-400"/> 提示：按住項目左側的把手圖示可拖曳調整順序；系統預設以「結案」兩字計算完成率。</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                      <DropdownManager title="反映管道" dbKey="channels" items={channels} showToast={showToast} showConfirm={showConfirm} />
                      <DropdownManager title="業務類別" dbKey="categories" items={categories} showToast={showToast} showConfirm={showConfirm} />
                      <DropdownManager title="案件狀態" dbKey="statuses" items={statuses} showToast={showToast} showConfirm={showConfirm} />
                      <DropdownManager title="處理進度" dbKey="progresses" items={progresses} showToast={showToast} showConfirm={showConfirm} />
                    </div>
                  </div>
                  <CategoryMappingManager categories={categories} mapping={categoryMapping} showToast={showToast} />
                </div>
              )}
            </div>
          )}

          {/* Canned Messages Modal */}
          {showCannedModal && (
            <CannedMessagesModal messages={cannedMessages} onClose={() => setShowCannedModal(false)} />
          )}

          {/* Toast 元件 */}
          {toast.show && (
            <div className={`fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center animate-in slide-in-from-bottom-5 fade-in duration-300 font-bold ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900'}`}>
              {toast.type === 'error' ? <AlertCircle size={18} className="mr-2" /> : <CheckCircle size={18} className="mr-2" />}
              {toast.msg}
            </div>
          )}

          {/* Confirm Modal 元件 */}
          {confirmDialog.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center"><AlertCircle className="mr-2 text-orange-500"/> 操作確認</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium leading-relaxed">{confirmDialog.msg}</p>
                <div className="flex justify-end space-x-3">
                  <button onClick={() => setConfirmDialog({ show: false, msg: '', onConfirm: null })} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">取消</button>
                  <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog({ show: false, msg: '', onConfirm: null }); }} className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg transition-transform active:scale-95">確定執行</button>
                </div>
              </div>
            </div>
          )}

          {/* 強制修改密碼 Modal */}
          {showForcePwdModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
                <div className="bg-indigo-100 dark:bg-indigo-900/50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6"><Lock size={32} className="text-indigo-600 dark:text-indigo-400"/></div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">安全設定：請修改初始密碼</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">為了確保您的帳號安全，系統要求您在首次登入時必須更改預設密碼。</p>
                <form onSubmit={handleForceChangePassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-2">設定新密碼</label>
                    <input type="password" required value={forcePwdForm.newPwd} onChange={e=>setForcePwdForm({...forcePwdForm, newPwd: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" placeholder="最少 6 個字元"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-2">再次確認密碼</label>
                    <input type="password" required value={forcePwdForm.confirmPwd} onChange={e=>setForcePwdForm({...forcePwdForm, confirmPwd: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" placeholder="重新輸入新密碼"/>
                  </div>
                  <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black mt-4 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">確認並啟用帳號</button>
                </form>
              </div>
            </div>
          )}
{/* 案件檢視與強制維護彈窗 (功能完整恢復版) */}
      {viewModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-10 bg-slate-900/80 backdrop-blur-sm animate-in fade-in" onClick={() => { setViewModalTicket(null); setIsEditingModal(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
             
             {/* Header */}
             <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-[3rem] shrink-0">
               <div>
                 <h3 className="font-black text-2xl text-slate-800 dark:text-white flex items-center">
                   案件詳細紀錄 <span className="ml-4 px-4 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-xl text-sm font-black shadow-inner">{viewModalTicket.ticketId}</span>
                 </h3>
                 <p className="text-sm font-bold text-slate-400 mt-2">案件建立於：{new Date(viewModalTicket.createdAt || viewModalTicket.receiveTime).toLocaleString()}</p>
               </div>
               <button onClick={() => { setViewModalTicket(null); setIsEditingModal(false); }} className="p-3 bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-all shadow-sm"><X size={24} className="text-slate-500"/></button>
             </div>

             {/* Content Area */}
             <div className="p-8 overflow-y-auto flex-1 space-y-10 bg-white dark:bg-slate-800">
               {!isEditingModal ? (
                  // --- 檢視模式 (完整欄位呈現) ---
                  <div className="space-y-8 animate-in fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       <InfoCard label="反映管道" value={viewModalTicket.channel} />
                       <InfoCard label="業務類別" value={viewModalTicket.category} />
                       <InfoCard label="處理負責人" value={viewModalTicket.assignee || viewModalTicket.receiver} isHighlight={!!viewModalTicket.assignee} />
                       <InfoCard label="案件進度" value={viewModalTicket.progress} isHighlight={viewModalTicket.progress === '結案'} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/30 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                       <InfoCard label="醫療院所" value={`${viewModalTicket.instName || '(無)'} ${viewModalTicket.instCode ? `(${viewModalTicket.instCode})` : ''}`} />
                       <InfoCard label="接收/來電時間" value={new Date(viewModalTicket.receiveTime).toLocaleString()} />
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2 block">客戶反映內容描述</label>
                       <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-[2.5rem] text-sm leading-relaxed dark:text-slate-200 whitespace-pre-wrap shadow-inner">
                          {viewModalTicket.extraInfo || '尚未填寫描述'}
                       </div>
                    </div>
                    <div className="space-y-3">
                       <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest ml-2 flex items-center"><MessageSquare size={16} className="mr-2"/> 完整回覆軌跡與歷程</label>
                       <div className="p-8 bg-blue-50/30 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-[2.5rem] text-sm leading-relaxed whitespace-pre-wrap dark:text-blue-200 shadow-inner">
                          {formatRepliesHistory(viewModalTicket.replies, viewModalTicket.replyContent) || '尚未有回覆紀錄'}
                       </div>
                    </div>
                  </div>
               ) : (
                  // --- 強制維護模式 (加入負責人維護) ---
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl flex items-center text-orange-700 dark:text-orange-400 text-sm font-bold shadow-sm">
                      <AlertCircle size={20} className="mr-3 shrink-0" /> 
                      管理員強制維護中：您可以修正包含處理人在內的所有核心欄位。
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700">
                      <EditField label="反映管道" val={(modalEditForm || {}).channel} setVal={(v) => setModalEditForm({...modalEditForm, channel: v})} type="select" options={channels} />
                      <EditField label="業務類別" val={(modalEditForm || {}).category} setVal={(v) => setModalEditForm({...modalEditForm, category: v})} type="select" options={categories} />
                      <EditField label="案件進度" val={(modalEditForm || {}).progress} setVal={(v) => setModalEditForm({...modalEditForm, progress: v})} type="select" options={progresses} />
                      <EditField 
                        label="負責同仁 (處理人)" 
                        val={(modalEditForm || {}).assignee || (modalEditForm || {}).receiver} 
                        setVal={(v) => setModalEditForm({...modalEditForm, assignee: v})} 
                        type="select" 
                        options={dbUsers
                          .filter(u => u.role !== '後台管理者' && u.role !== '系統管理員' && u.role !== '紀錄檢視者')
                          .map(u => u.username)
                        } 
                      />
                      <EditField label="院所代碼" val={(modalEditForm || {}).instCode} setVal={(v) => setModalEditForm({...modalEditForm, instCode: v})} />
                      <EditField label="院所名稱" val={(modalEditForm || {}).instName} setVal={(v) => setModalEditForm({...modalEditForm, instName: v})} />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 space-y-6">
                      <EditField label="反映內容描述" val={(modalEditForm || {}).extraInfo} setVal={(v) => setModalEditForm({...modalEditForm, extraInfo: v})} type="textarea" />
                      <EditField label="初步/最新回覆" val={(modalEditForm || {}).replyContent} setVal={(v) => setModalEditForm({...modalEditForm, replyContent: v})} type="textarea" />
                    </div>
                  </div>
               )}
             </div>
             
             {/* Action Buttons */}
             <div className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0 rounded-b-[3rem]">
                {currentUser?.role === ROLES.ADMIN ? (
                   !isEditingModal ? (
                      <button onClick={() => { setModalEditForm({...viewModalTicket}); setIsEditingModal(true); }} className="px-8 py-4 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-2xl font-black hover:bg-orange-200 transition-all flex items-center shadow-sm">
                        <Edit size={18} className="mr-2"/> 強制維護
                      </button>
                   ) : (
                      <button onClick={() => setIsEditingModal(false)} className="px-8 py-4 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-300 transition-all shadow-sm">
                        取消編輯
                      </button>
                   )
                ) : <div className="p-4"></div>}
                
                <div className="flex space-x-4">
                   {!isEditingModal ? (
                      <button onClick={() => setViewModalTicket(null)} className="px-12 py-4 bg-slate-800 dark:bg-slate-600 text-white rounded-2xl font-black hover:bg-slate-700 transition-all shadow-xl shadow-slate-200 dark:shadow-none">關閉視窗</button>
                   ) : (
                      <button 
                        onClick={async () => {
                          if (!modalEditForm || !viewModalTicket) return;
                          try {
                            await updateDoc(doc(db, 'cs_records', viewModalTicket.id), {
                              ...modalEditForm,
                              editLogs: [...(viewModalTicket.editLogs || []), { time: new Date().toISOString(), user: currentUser?.username || '系統員', action: '強制維護更新' }]
                            });
                            showToast('案件資料已成功強制更新', 'success');
                            setIsEditingModal(false);
                            setViewModalTicket(null);
                          } catch (e) { showToast('更新失敗，請檢查權限', 'error'); }
                        }} 
                        className="px-12 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 transition-all flex items-center shadow-xl shadow-green-200 dark:shadow-none"
                      >
                        <Save size={20} className="mr-2" /> 儲存變更
                      </button>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}
{/* 案件檢視與強制維護彈窗 (功能完整恢復版)結尾 */}
        </div>
      </div>
    </div>
    </div>
  );
}


const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
