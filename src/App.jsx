import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Phone, MessageCircle, Clock, Save, FileText, BarChart3, 
  Search, CheckCircle, AlertCircle, User, Building2, 
  List, LayoutDashboard, Plus, X, PhoneCall,
  Settings, Trash2, Upload, Database, Edit, UserPlus, Shield, Lock, Calendar, Tags,
  Copy, Check, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, Download
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, writeBatch, setDoc } from 'firebase/firestore';

// --- System Variables ---
const APP_VERSION = "v1.5.0 (正式版)";

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  // ⚠️ 如果不在 Vercel 整合環境，請在此替換您的金鑰
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

// --- Constants ---
const ROLES = {
  ADMIN: "後台管理者",
  USER: "一般使用者",
  VIEWER: "紀錄檢視者"
};

// --- Utility Functions (Timezone Safe) ---
const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};

const getFirstDayOfMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const getLastDayOfMonth = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  // 取得當月的最後一天
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
  return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
};

const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 表單初始狀態完全淨空，稍後由資料庫讀取後動態帶入
const getInitialForm = (username = '') => ({
  receiveTime: getFormatDate(),
  callEndTime: '',
  channel: '',
  receiver: username,
  instCode: '',
  instName: '',
  instLevel: '',
  category: '',
  status: '',
  extraInfo: '',
  questioner: '',
  replyContent: '',
  closeTime: '',
  progress: '',
  assignee: '',
  replies: []
});

// --- Components ---

// 1. 純原生 SVG 折線圖組件
const LineChart = ({ data, labels }) => {
  if (data.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400">無數據</div>;
  const maxVal = Math.max(...data, 10);
  const height = 200;
  const width = 600;
  const paddingX = 40;
  const paddingY = 20;
  
  const points = data.map((val, i) => {
    const x = paddingX + (i * ((width - paddingX * 2) / (data.length - 1 || 1)));
    const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full overflow-x-auto relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 md:h-64 drop-shadow-sm">
        {[0, 0.5, 1].map(ratio => {
          const y = height - paddingY - ratio * (height - paddingY * 2);
          return (
            <g key={ratio}>
              <line x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={paddingX - 10} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{Math.round(maxVal * ratio)}</text>
            </g>
          );
        })}
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((val, i) => {
          const x = paddingX + (i * ((width - paddingX * 2) / (data.length - 1 || 1)));
          const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#ffffff" stroke="#3b82f6" strokeWidth="2" className="transition-all hover:r-6" />
              <text x={x} y={height - 5} fontSize="10" fill="#64748b" textAnchor="middle">{labels[i]}</text>
              <text x={x} y={y - 10} fontSize="12" fill="#1e293b" textAnchor="middle" fontWeight="bold">{val}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// 2. 罐頭文字彈出式視窗組件
const CannedMessagesModal = ({ messages, onClose }) => {
  const [copyId, setCopyId] = useState(null);

  const handleCopy = (text, idx) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyId(idx);
      setTimeout(() => setCopyId(null), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-black text-lg flex items-center text-slate-800">
            <MessageSquare size={20} className="mr-2 text-blue-600"/> 選擇罐頭回覆
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {messages.map((m, idx) => (
            <div 
              key={idx} 
              className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all group relative cursor-pointer" 
              onClick={() => handleCopy(m, idx)}
              title="點擊複製"
            >
              <p className="text-sm text-slate-600 line-clamp-4 leading-relaxed pr-6">{m}</p>
              <button className="absolute top-2 right-2 p-1.5 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600">
                {copyId === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          ))}
          {(!messages || messages.length === 0) && (
            <p className="text-xs text-slate-400 text-center py-6">目前尚無罐頭文字，請至設定區新增。</p>
          )}
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 font-bold text-center shrink-0 flex items-center justify-center">
          <CheckCircle size={14} className="mr-1 text-green-500"/> 點擊卡片即可複製，請自行貼入答覆框中
        </div>
      </div>
    </div>
  );
};


// 3. 主應用程式
export default function App() {
  // Auth State
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  
  // App State
  const [activeTab, setActiveTab] = useState('form'); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' });

  // Dropdown States (100% Data-Driven)
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [progresses, setProgresses] = useState([]);
  const [cannedMessages, setCannedMessages] = useState([]);
  const [showCannedModal, setShowCannedModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState(getInitialForm());
  const [isLookingUp, setIsLookingUp] = useState(false);

  // 當動態選單讀取完成後，自動為新增表單帶入預設首選項
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      channel: prev.channel || (channels[0] || ''),
      category: prev.category || (categories[0] || ''),
      status: prev.status || (statuses[0] || ''),
      progress: prev.progress || (progresses[0] || '')
    }));
  }, [channels, categories, statuses, progresses]);

  // History State
  const [searchTerm, setSearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState(getFirstDayOfMonth());
  const [historyEndDate, setHistoryEndDate] = useState(getLastDayOfMonth());
  const [historyProgress, setHistoryProgress] = useState('全部');
  const [sortConfig, setSortConfig] = useState({ key: 'receiveTime', direction: 'desc' });

  // Dashboard State
  const [dashStartDate, setDashStartDate] = useState(getFirstDayOfMonth());
  const [dashEndDate, setDashEndDate] = useState(getLastDayOfMonth());
  const [trendCategory, setTrendCategory] = useState('全類別');

  // Maintenance State
  const [maintainSearchTerm, setMaintainSearchTerm] = useState('');
  const [maintainModal, setMaintainModal] = useState(null);
  const [maintainForm, setMaintainForm] = useState({ progress: '', assignee: '', newReply: '' });

  // Institution State
  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  const [newInst, setNewInst] = useState({ code: '', name: '', level: '診所' });
  const [instSubmitMsg, setInstSubmitMsg] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showInstList, setShowInstList] = useState(false);
  const [instSearchTerm, setInstSearchTerm] = useState('');
  
  // User Management & Password State
  const [newUser, setNewUser] = useState({ username: '', password: '', role: ROLES.USER });
  const [pwdChangeForm, setPwdChangeForm] = useState({ newPwd: '', confirmPwd: '' });
  const [pwdChangeMsg, setPwdChangeMsg] = useState('');

  // --- Initialization ---
  useEffect(() => {
    if (!document.getElementById('xlsx-script')) {
      const script = document.createElement('script');
      script.id = 'xlsx-script';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.body.appendChild(script);
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!firebaseUser) return;

    const baseDbPath = typeof __app_id !== 'undefined' 
      ? ['artifacts', appId, 'public', 'data'] 
      : []; 

    const buildPath = (colName) => baseDbPath.length ? collection(db, ...baseDbPath, colName) : collection(db, colName);
    const buildDocPath = (colName, docId) => baseDbPath.length ? doc(db, ...baseDbPath, colName, docId) : doc(db, colName, docId);

    // 1. 監聽使用者清單
    const unsubscribeUsers = onSnapshot(query(buildPath('cs_users')), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDbUsers(usersList);
      setLoading(false);
    });

    // 2. 監聽案件紀錄
    const unsubscribeTickets = onSnapshot(query(buildPath('cs_records')), (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTickets(records); 
    });

    // 3. 監聽院所資料
    const unsubscribeInst = onSnapshot(query(buildPath('mohw_institutions')), (snapshot) => {
      let instList = [];
      const map = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isChunk && data.payload) {
          try {
            JSON.parse(data.payload).forEach(item => {
              instList.push({ id: doc.id, isChunk: true, ...item });
              map[item.code] = { name: item.name, level: item.level };
            });
          } catch (e) {}
        } else {
          instList.push({ id: doc.id, isChunk: false, ...data });
          map[data.code] = { name: data.name, level: data.level };
        }
      });
      setInstitutions(instList);
      setInstMap(map);
    });

    // 4. 監聽下拉選單動態設定
    const unsubscribeSettings = onSnapshot(buildDocPath('cs_settings', 'dropdowns'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChannels(data.channels || []);
        setCategories(data.categories || []);
        setStatuses(data.statuses || []);
        setProgresses(data.progresses || []);
        setCannedMessages(data.cannedMessages || []);
      } else {
        // 如果還沒有設定檔，建立預設值防呆
        const defaultSettings = {
          channels: ["電話", "LINE"],
          categories: ["慢防-成人預防保健", "其他"],
          statuses: ["詢問步驟", "其他"],
          progresses: ["待處理", "處理中", "待回覆", "結案"],
          cannedMessages: ["請提供更詳細的相關資訊以便查詢"]
        };
        setDoc(buildDocPath('cs_settings', 'dropdowns'), defaultSettings);
      }
    });

    return () => { 
      unsubscribeUsers(); 
      unsubscribeTickets(); 
      unsubscribeInst(); 
      unsubscribeSettings();
    };
  }, [firebaseUser]);

  // --- Auth Handlers ---
  const handleLogin = (e) => {
    e.preventDefault();
    const user = dbUsers.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (user) {
      setCurrentUser(user);
      setFormData(getInitialForm(user.username));
      setAuthError('');
    } else {
      setAuthError('帳號或密碼錯誤');
    }
  };

  const handleCreateFirstAdmin = async (e) => {
    e.preventDefault();
    if (dbUsers.length > 0) return;
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'cs_users') : collection(db, 'cs_users'), {
        username: loginForm.username,
        password: loginForm.password,
        role: ROLES.ADMIN,
        createdAt: new Date().toISOString()
      });
      setAuthError('管理員建立成功，請點擊登入');
      setLoginForm({ username: '', password: '' });
    } catch (e) { setAuthError('建立失敗'); }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginForm({username:'', password:''});
    setActiveTab('form');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (dbUsers.some(u => u.username === newUser.username)) {
      alert('帳號名稱已存在'); return;
    }
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'cs_users') : collection(db, 'cs_users'), { ...newUser, createdAt: new Date().toISOString() });
      setNewUser({ username: '', password: '', role: ROLES.USER });
    } catch(e) { console.error(e); }
  };

  const handleDeleteUser = async (id) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (window.confirm('確定要刪除此使用者嗎？')) {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await deleteDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', id) : doc(db, 'cs_users', id));
    }
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    if (pwdChangeForm.newPwd !== pwdChangeForm.confirmPwd) {
      setPwdChangeMsg('❌ 兩次輸入的密碼不一致，請重新輸入！');
      return;
    }
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', currentUser.id) : doc(db, 'cs_users', currentUser.id), { password: pwdChangeForm.newPwd });
      setPwdChangeMsg('✅ 密碼更新成功！下次登入請使用新密碼。');
      setPwdChangeForm({ newPwd: '', confirmPwd: '' });
      setTimeout(() => setPwdChangeMsg(''), 5000);
    } catch (e) {
      setPwdChangeMsg('❌ 密碼更新失敗：' + e.message);
    }
  };

  const handleResetUserPassword = async (id, username) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    const newPwd = window.prompt(`請輸入要為用戶「${username}」設定的新密碼：\n(設定後請將此密碼轉交給該用戶)`);
    if (newPwd) {
      try {
        const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
        await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_users', id) : doc(db, 'cs_users', id), { password: newPwd.trim() });
        alert(`✅ 用戶「${username}」的密碼已成功重置為：${newPwd.trim()}`);
      } catch (e) {
        alert('密碼重置失敗：' + e.message);
      }
    }
  };

  // --- Ticket Handlers ---
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    if (name === 'progress' && value === '結案' && !formData.closeTime) newFormData.closeTime = getFormatDate();
    if (name === 'progress' && value !== '結案' && formData.closeTime) newFormData.closeTime = '';
    // 若是結案，清空指派
    if (name === 'progress' && value === '結案') newFormData.assignee = '';
    setFormData(newFormData);
  };

  const handleInstCodeBlur = () => {
    if (!formData.instCode) return;
    setIsLookingUp(true);
    setTimeout(() => {
      const rawCode = formData.instCode.trim();
      const paddedCode = rawCode.padStart(10, '0');
      let data = instMap[rawCode] || instMap[paddedCode];
      if (data) {
        setFormData(prev => ({ ...prev, instCode: rawCode.length < 10 ? paddedCode : rawCode, instName: data.name, instLevel: data.level }));
      } else {
        setFormData(prev => ({ ...prev, instName: '查無資料，請確認代碼或手動新增', instLevel: '' }));
      }
      setIsLookingUp(false);
    }, 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) {
      setSubmitStatus({ type: 'error', msg: '您沒有新增權限' }); return;
    }
    try {
      setSubmitStatus({ type: 'loading', msg: '儲存中...' });
      
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const todayTickets = tickets.filter(t => t.ticketId && t.ticketId.startsWith(todayStr));
      let maxSeq = 0;
      todayTickets.forEach(t => {
        const seq = parseInt(t.ticketId.slice(8), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      });
      const newTicketId = todayStr + String(maxSeq + 1).padStart(5, '0');

      const initialReplies = formData.replyContent ? [{
        time: getFormatDate(),
        user: currentUser.username,
        content: formData.replyContent
      }] : [];

      const submissionData = {
        ...formData,
        ticketId: newTicketId,
        replies: initialReplies,
        createdAt: new Date().toISOString()
      };

      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'cs_records') : collection(db, 'cs_records'), submissionData);
      
      setSubmitStatus({ type: 'success', msg: `案件 ${newTicketId} 建立成功！` });
      
      // 送出後維持目前動態選單預設值
      setFormData(prev => ({
        ...getInitialForm(currentUser.username),
        channel: channels.includes(prev.channel) ? prev.channel : (channels[0] || ''),
        category: categories.includes(prev.category) ? prev.category : (categories[0] || ''),
        status: statuses.includes(prev.status) ? prev.status : (statuses[0] || ''),
        progress: progresses.includes(prev.progress) ? prev.progress : (progresses[0] || '待處理')
      }));
      setTimeout(() => setSubmitStatus({ type: '', msg: '' }), 4000);
    } catch (error) {
      setSubmitStatus({ type: 'error', msg: '儲存失敗。' });
    }
  };

  // --- Maintenance Handlers ---
  const maintainTicketsList = useMemo(() => {
    if (!currentUser) return [];

    return tickets.filter(t => {
      const matchSearch = maintainSearchTerm ? 
        ((t.ticketId || '').includes(maintainSearchTerm) || (t.instName || '').includes(maintainSearchTerm)) : true;
      
      if (currentUser.role === ROLES.ADMIN) {
        if (maintainSearchTerm) return matchSearch; 
        return t.progress !== '結案'; 
      } else {
        const isMine = t.receiver === currentUser.username || t.assignee === currentUser.username;
        const isUnresolved = t.progress !== '結案';
        if (maintainSearchTerm) return isMine && isUnresolved && matchSearch;
        return isMine && isUnresolved;
      }
    });
  }, [tickets, currentUser, maintainSearchTerm]);

  const openMaintainModal = (ticket) => {
    setMaintainModal(ticket);
    setMaintainForm({
      progress: ticket.progress,
      assignee: ticket.assignee || '',
      newReply: ''
    });
  };

  const handleMaintainSubmit = async (e) => {
    e.preventDefault();
    if (currentUser?.role === ROLES.VIEWER) return alert("無權限");
    
    try {
      const updates = { progress: maintainForm.progress };
      
      if (maintainForm.progress === '結案' && maintainModal.progress !== '結案') {
        updates.closeTime = getFormatDate();
      } else if (maintainForm.progress !== '結案' && maintainModal.closeTime) {
        updates.closeTime = '';
      }

      if (maintainForm.progress !== '結案') {
        updates.assignee = maintainForm.assignee;
      } else {
        updates.assignee = ''; 
      }

      if (maintainForm.newReply.trim()) {
        const newReplyObj = {
          time: getFormatDate(),
          user: currentUser.username,
          content: maintainForm.newReply.trim()
        };
        updates.replies = [...(maintainModal.replies || []), newReplyObj];
        updates.replyContent = maintainForm.newReply.trim();
      }

      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await updateDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'cs_records', maintainModal.id) : doc(db, 'cs_records', maintainModal.id), updates);
      setMaintainModal(null);
    } catch (error) {
      alert("更新失敗：" + error.message);
    }
  };

  // --- Export Excel Handler ---
  const handleExportExcel = () => {
    if (!window.XLSX) {
      alert("Excel 模組尚未載入完成，請稍後再試。");
      return;
    }
    if (filteredAndSortedHistory.length === 0) {
      alert("目前沒有資料可以匯出。");
      return;
    }

    const exportData = filteredAndSortedHistory.map(t => ({
      '案件號': t.ticketId || '',
      '接收時間': new Date(t.receiveTime).toLocaleString(),
      '反映管道': t.channel || '',
      // 加入 \u200B (Zero-width space) 強制轉為文字，避免 Excel 開啟時去除首碼 0
      '院所代碼': t.instCode ? String(t.instCode) + '\u200B' : '',
      '院所名稱': t.instName || '',
      '醫療層級': t.instLevel || '',
      '提問人資訊': t.questioner || '',
      '業務類別': t.category || '',
      '案件狀態': t.status || '',
      '處理進度': t.progress || '',
      '建檔人': t.receiver || '',
      '指定處理人': t.assignee || '',
      '詳細問題描述': t.extraInfo || '',
      '回覆內容': t.replyContent || '',
      '結案時間': t.closeTime ? new Date(t.closeTime).toLocaleString() : ''
    }));

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "歷史查詢結果");
    
    const fileName = `客服紀錄匯出_${getToday().replace(/-/g, '')}.xlsx`;
    window.XLSX.writeFile(wb, fileName);
  };

  // --- Dynamic Dropdown Handlers (Settings) ---
  const DropdownManager = ({ title, dbKey, items }) => {
    const [newItem, setNewItem] = useState('');
    const handleAdd = async (e) => {
      e.preventDefault();
      if (!newItem.trim() || items.includes(newItem.trim())) return;
      const newArray = [...items, newItem.trim()];
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { [dbKey]: newArray }, { merge: true });
      setNewItem('');
    };
    const handleRemove = async (itemToRemove) => {
      if (!window.confirm(`確定要刪除「${itemToRemove}」嗎？`)) return;
      const newArray = items.filter(i => i !== itemToRemove);
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { [dbKey]: newArray }, { merge: true });
    };

    return (
      <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 flex flex-col h-full">
        <h4 className="font-bold text-sm mb-4 text-slate-700">{title}</h4>
        <form onSubmit={handleAdd} className="flex mb-4 gap-2">
          <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="新增項目..."/>
          <button type="submit" className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm"><Plus size={18}/></button>
        </form>
        <ul className="space-y-2 overflow-y-auto flex-1 pr-2 min-h-[150px]">
          {items.map(item => (
            <li key={item} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-sm group">
              <span className="text-slate-700 font-medium truncate" title={item}>{item}</span>
              <button type="button" onClick={() => handleRemove(item)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // --- Inst Management Handlers ---
  const handleAddInst = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN && currentUser?.role !== ROLES.USER) return;
    const paddedCode = newInst.code.trim().padStart(10, '0');
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      await addDoc(baseDbPath.length ? collection(db, ...baseDbPath, 'mohw_institutions') : collection(db, 'mohw_institutions'), { code: paddedCode, name: newInst.name, level: newInst.level });
      setNewInst({ code: '', name: '', level: '診所' });
      setInstSubmitMsg('單筆新增成功！'); setTimeout(() => setInstSubmitMsg(''), 3000);
    } catch (e) { console.error(e); }
  };

  const handleDeleteInst = async (id) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
    await deleteDoc(baseDbPath.length ? doc(db, ...baseDbPath, 'mohw_institutions', id) : doc(db, 'mohw_institutions', id));
  };

  const handleClearAllInsts = async () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!window.confirm('確定要清空所有院所資料嗎？')) return;
    setIsImporting(true);
    try {
      const batch = writeBatch(db);
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      institutions.forEach(inst => {
        batch.delete(baseDbPath.length ? doc(db, ...baseDbPath, 'mohw_institutions', inst.id) : doc(db, 'mohw_institutions', inst.id));
      });
      await batch.commit();
    } catch (e) { console.error(e); }
    finally { setIsImporting(false); }
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
          const docRef = baseDbPath.length ? doc(collection(db, ...baseDbPath, 'mohw_institutions')) : doc(collection(db, 'mohw_institutions'));
          batch.set(docRef, { isChunk: true, payload: JSON.stringify(chunkData) });
          await batch.commit();
        }
      } catch (error) {}
      finally { setIsImporting(false); e.target.value = null; }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredInsts = useMemo(() => {
    return institutions.filter(inst => (inst.code||'').includes(instSearchTerm) || (inst.name||'').includes(instSearchTerm));
  }, [institutions, instSearchTerm]);

  // --- History Filtering & Sorting ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedHistory = useMemo(() => {
    // Filter
    let result = tickets.filter(t => {
      const matchSearch = searchTerm === '' || 
        (t.ticketId||'').includes(searchTerm) || 
        (t.instName||'').includes(searchTerm) || 
        (t.extraInfo||'').includes(searchTerm) || 
        (t.receiver||'').includes(searchTerm);
      
      const matchProgress = historyProgress === '全部' || t.progress === historyProgress;
      
      let matchDate = true;
      if (historyStartDate && historyEndDate) {
        const tDate = t.receiveTime.slice(0, 10);
        matchDate = tDate >= historyStartDate && tDate <= historyEndDate;
      }

      return matchSearch && matchProgress && matchDate;
    });

    // Sort
    result.sort((a, b) => {
      let valA = a[sortConfig.key] || '';
      let valB = b[sortConfig.key] || '';

      if (sortConfig.key === 'receiveTime') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [tickets, searchTerm, historyStartDate, historyEndDate, historyProgress, sortConfig]);

  // History Sortable Header Component
  const SortHeader = ({ label, sortKey, align = 'left' }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className={`p-5 cursor-pointer hover:bg-slate-100 transition-colors select-none ${align === 'center' ? 'text-center' : 'text-left'}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center ${align === 'center' ? 'justify-center' : 'justify-start'} group`}>
          {label}
          <span className={`ml-1 flex flex-col ${isActive ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
            {isActive ? (
              sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>
            ) : (
              <ArrowUpDown size={14} />
            )}
          </span>
        </div>
      </th>
    );
  };


  // --- Analytics Data Generation ---
  const dashboardStats = useMemo(() => {
    const total = tickets.length;
    const pending = tickets.filter(t => t.progress !== '結案').length; // 未結案皆視為待處理
    const resolved = tickets.filter(t => t.progress === '結案').length;
    const completionRate = total ? Math.round((resolved/total)*100) : 0;
    
    const startDateObj = new Date(`${dashStartDate}T00:00:00`);
    const endDateObj = new Date(`${dashEndDate}T23:59:59.999`);
    
    const rangeTickets = tickets.filter(t => {
      const tDate = new Date(t.receiveTime);
      return tDate >= startDateObj && tDate <= endDateObj;
    });

    const categoryData = {};
    categories.forEach(c => categoryData[c] = 0); // Initialize dynamically
    rangeTickets.forEach(t => {
      if (categories.includes(t.category)) {
        categoryData[t.category] = (categoryData[t.category] || 0) + 1;
      } else {
        categoryData['已停用類別'] = (categoryData['已停用類別'] || 0) + 1;
      }
    });

    const monthLabels = [];
    for(let i=5; i>=0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthLabels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }

    const trendDataArray = monthLabels.map(monthStr => {
      return tickets.filter(t => {
        const matchMonth = t.receiveTime.substring(0, 7) === monthStr;
        const matchCat = trendCategory === '全類別' || t.category === trendCategory;
        return matchMonth && matchCat;
      }).length;
    });

    return { total, pending, resolved, completionRate, categoryData, trendDataArray, monthLabels };
  }, [tickets, dashStartDate, dashEndDate, trendCategory, categories]);

  // --- Render Login Screen ---
  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;

  if (!currentUser) {
    const isFirstTime = dbUsers.length === 0;
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl z-10 w-full max-w-md border border-slate-100 flex flex-col relative">
          <div className="text-center mb-10">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <Shield size={32} className="text-white"/>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">系統存取驗證</h2>
            <p className="text-slate-400 text-sm mt-2">{isFirstTime ? '初始化系統：建立最高管理員' : '請選擇您的帳號並輸入密碼'}</p>
            <div className="mt-2 text-[10px] text-slate-400 font-mono font-bold tracking-widest">{APP_VERSION}</div>
          </div>

          <form onSubmit={isFirstTime ? handleCreateFirstAdmin : handleLogin} className="space-y-6">
            {isFirstTime ? (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">建立管理員帳號</label>
                  <input type="text" required value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">設定密碼</label>
                  <input type="password" required value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"/>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">帳號</label>
                  <select required value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700">
                    <option value="" disabled>請選擇使用者...</option>
                    {dbUsers.map(u => <option key={u.id} value={u.username}>{u.username} ({u.role})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">密碼</label>
                  <input type="password" required value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"/>
                </div>
              </>
            )}
            
            {authError && <p className="text-sm text-red-500 font-bold text-center animate-pulse">{authError}</p>}
            
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 flex justify-center items-center">
              {isFirstTime ? '初始化資料庫' : <><Lock size={16} className="mr-2"/> 登入系統</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Navigation Component ---
  const NavButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-3 w-full px-4 py-3.5 rounded-xl transition-all duration-200 ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      <Icon size={20} />
      <span className="font-bold text-sm tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3 mb-2">
          <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-inner"><PhoneCall size={22} /></div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">客服中心</h1>
        </div>
        <div className="px-6 py-4 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-blue-600 font-black border border-slate-200">
            {currentUser.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-sm">{currentUser.username}</div>
            <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-0.5">{currentUser.role}</div>
          </div>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          <NavButton id="form" icon={Plus} label="新增紀錄區" />
          <NavButton id="maintenance" icon={Edit} label="紀錄維護區" />
          <NavButton id="list" icon={List} label="歷史查詢區" />
          <NavButton id="dashboard" icon={LayoutDashboard} label="進階統計區" />
          <NavButton id="settings" icon={Settings} label="系統設定區" />
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">登出系統</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50 relative">
        <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto">
          
          {/* TAB 1: FORM */}
          {activeTab === 'form' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8">
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">新增紀錄區</h2>
                  <p className="text-sm text-slate-400 mt-2">以 <span className="font-bold text-blue-600">{currentUser.username}</span> 身份登錄。</p>
                </div>
              </div>

              {submitStatus.msg && (
                <div className={`p-4 rounded-2xl flex items-center space-x-3 border ${submitStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                  <CheckCircle size={20}/>
                  <span className="font-bold">{submitStatus.msg}</span>
                </div>
              )}

              {/* Main Form Area */}
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 tracking-wide uppercase text-sm"><User size={18} className="mr-2"/> 基本與院所資訊</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">接收時間</label><input type="datetime-local" name="receiveTime" required value={formData.receiveTime} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                    <div><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">反映管道</label><select name="channel" value={formData.channel} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none">{channels.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">提問人資訊</label><input type="text" name="questioner" value={formData.questioner} onChange={handleFormChange} className="w-full p-3.5 border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="姓名 / 電話 / LINE"/></div>
                    
                    <div className="md:col-span-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">院所代碼 (自動比對)</label>
                      <input type="text" name="instCode" value={formData.instCode} onChange={handleFormChange} onBlur={handleInstCodeBlur} className="w-full p-3.5 border border-slate-200 rounded-2xl font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="輸入10碼後點擊空白處"/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">院所名稱與層級</label>
                      <div className="flex space-x-4">
                        <input type="text" name="instName" value={formData.instName} readOnly className="w-2/3 p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-600 font-bold outline-none" placeholder="名稱"/>
                        <input type="text" name="instLevel" value={formData.instLevel} readOnly className="w-1/3 p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-500 font-bold outline-none" placeholder="層級"/>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 tracking-wide uppercase text-sm"><FileText size={18} className="mr-2"/> 案件內容與指派</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div><label className="text-xs font-bold mb-2 block text-slate-700">類別</label><select name="category" value={formData.category} onChange={handleFormChange} className="w-full p-3 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="text-xs font-bold mb-2 block text-slate-700">狀態</label><select name="status" value={formData.status} onChange={handleFormChange} className="w-full p-3 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs font-bold mb-2 block text-slate-700">進度</label><select name="progress" value={formData.progress} onChange={handleFormChange} className={`w-full p-3 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 ${formData.progress === '結案' ? 'text-green-600 bg-green-50 focus:ring-green-500' : formData.progress === '待處理' ? 'text-red-600 bg-red-50 focus:ring-red-500' : 'text-orange-600 bg-orange-50 focus:ring-orange-500'}`}>{progresses.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                    
                    {/* 指派功能：只要不是結案即可指派 */}
                    {formData.progress !== '結案' ? (
                      <div className="animate-in zoom-in-95 duration-200">
                        <label className="text-xs font-bold mb-2 block text-red-600 flex items-center"><UserPlus size={14} className="mr-1"/> 指定處理人</label>
                        <select name="assignee" value={formData.assignee} onChange={handleFormChange} className="w-full p-3 border-2 border-red-200 rounded-2xl bg-white font-bold text-red-700 outline-none focus:border-red-500">
                           <option value="">-- 未指定 --</option>
                           {dbUsers.map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                        </select>
                      </div>
                    ) : <div></div>}
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold mb-2 block text-slate-700">詳細問題描述</label>
                      <textarea name="extraInfo" value={formData.extraInfo} onChange={handleFormChange} rows="4" className="w-full p-5 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50" placeholder="詳細問題描述..."></textarea>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="text-xs font-bold block text-slate-700">給予的初步答覆 (選填)</label>
                        <button type="button" onClick={() => setShowCannedModal(true)} className="text-xs font-bold text-blue-600 flex items-center bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                          <MessageSquare size={14} className="mr-1"/> 呼叫罐頭文字
                        </button>
                      </div>
                      <textarea id="replyContent" name="replyContent" value={formData.replyContent} onChange={handleFormChange} rows="4" className="w-full p-5 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/30" placeholder="給予的初步答覆 (選填)..."></textarea>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 pb-12">
                  <button type="submit" disabled={submitStatus.type === 'loading' || currentUser.role === ROLES.VIEWER} className={`px-14 py-4 text-white rounded-[1.5rem] font-black flex items-center shadow-2xl transition-all ${currentUser.role === ROLES.VIEWER ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:scale-95'}`}>
                    {submitStatus.type === 'loading' ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div> : <Save size={22} className="mr-3"/>} 
                    {currentUser.role === ROLES.VIEWER ? '權限不足' : '儲存案件'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: MAINTENANCE (紀錄維護區) */}
          {activeTab === 'maintenance' && (
             <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6 relative">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
                 <div>
                   <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">紀錄維護區</h2>
                   <p className="text-sm text-slate-500">
                     {currentUser.role === ROLES.ADMIN ? '管理員可查詢案件號以維護「已結案」紀錄。' : '僅顯示您負責或建檔的未結案紀錄。'}
                   </p>
                 </div>
                 <div className="relative w-full md:w-80">
                   <Search size={18} className="absolute left-4 top-3.5 text-slate-400"/>
                   <input type="text" placeholder="輸入案件號碼查詢..." value={maintainSearchTerm} onChange={(e)=>setMaintainSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"/>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                  {maintainTicketsList.map(t => (
                    <div key={t.id} onClick={() => openMaintainModal(t)} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group flex flex-col h-full relative">
                      <div className="absolute top-4 right-6 text-[10px] font-mono text-slate-300">#{t.ticketId || t.id.slice(0,8)}</div>
                      <div className="flex justify-between items-start mb-4 mt-2">
                         <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${t.progress==='結案'?'bg-green-100 text-green-700':t.progress==='待處理'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'}`}>{t.progress}</span>
                         <span className="text-xs font-bold text-slate-400">{new Date(t.receiveTime).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-lg text-slate-800 mb-1">{t.instName || '無特定院所'}</h4>
                      <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{t.extraInfo}</p>
                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-400 flex items-center"><User size={14} className="mr-1"/> {t.receiver} 建檔</span>
                        {t.assignee && <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">負責: {t.assignee}</span>}
                      </div>
                    </div>
                  ))}
                  {maintainTicketsList.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 font-bold text-lg">目前沒有符合條件的案件 🎉</div>}
               </div>

               {/* 維護互動彈窗 */}
               {maintainModal && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                   <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                     <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                       <h3 className="font-black text-lg flex items-center"><Edit size={20} className="mr-2 text-blue-600"/> 案件維護 - {maintainModal.instName}</h3>
                       <button onClick={() => setMaintainModal(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                     </div>
                     <div className="p-8 overflow-y-auto flex-1 space-y-6">
                       {/* 原始內容 (唯讀) */}
                       <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                         <div className="flex justify-between">
                           <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">原始描述</div>
                           <div className="text-[10px] font-mono text-slate-400 font-bold">案件號: {maintainModal.ticketId || '舊案件'}</div>
                         </div>
                         <p className="text-sm text-slate-700">{maintainModal.extraInfo || '(無)'}</p>
                       </div>
                       
                       {/* 歷史答覆軌跡 (唯讀) */}
                       <div>
                         <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">答覆軌跡紀錄</div>
                         {maintainModal.replies && maintainModal.replies.length > 0 ? (
                           <div className="space-y-4">
                             {maintainModal.replies.map((r, i) => (
                               <div key={i} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-start space-x-3">
                                 <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs shrink-0">{r.user.charAt(0).toUpperCase()}</div>
                                 <div>
                                   <div className="text-xs font-bold text-slate-800 mb-1">{r.user} <span className="text-[10px] text-slate-400 font-normal ml-2">{new Date(r.time).toLocaleString()}</span></div>
                                   <div className="text-sm text-slate-600 leading-relaxed">{r.content}</div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         ) : <div className="text-sm text-slate-400 italic">尚無任何答覆紀錄</div>}
                       </div>

                       {/* 維護表單 */}
                       <form id="maintain-form" onSubmit={handleMaintainSubmit} className="space-y-6 pt-6 border-t border-slate-100">
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="text-xs font-black text-slate-800 mb-2 block">更新進度</label>
                             <select value={maintainForm.progress} onChange={e=>setMaintainForm({...maintainForm, progress:e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 font-bold outline-none">
                               {progresses.map(p=><option key={p} value={p}>{p}</option>)}
                             </select>
                           </div>
                           {/* 變更指定用戶 (只要不是結案即可用) */}
                           {maintainForm.progress !== '結案' ? (
                             <div>
                               <label className="text-xs font-black text-red-600 mb-2 block">指派後續處理人</label>
                               <select value={maintainForm.assignee} onChange={e=>setMaintainForm({...maintainForm, assignee:e.target.value})} className="w-full p-3 border-2 border-red-200 rounded-xl font-bold text-red-700 outline-none">
                                 <option value="">-- 未指定 --</option>
                                 {dbUsers.map(u=><option key={u.id} value={u.username}>{u.username}</option>)}
                               </select>
                             </div>
                           ) : <div className="opacity-50"><label className="text-xs font-black text-slate-400 mb-2 block">處理人</label><input disabled value={maintainForm.assignee || '自動清除指派'} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50"/></div>}
                         </div>
                         <div>
                           <div className="flex justify-between items-end mb-2">
                             <label className="text-xs font-black text-slate-800 block">追加新答覆 / 註記</label>
                             <button type="button" onClick={() => setShowCannedModal(true)} className="text-xs font-bold text-blue-600 flex items-center bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                               <MessageSquare size={14} className="mr-1"/> 呼叫罐頭文字
                             </button>
                           </div>
                           <textarea value={maintainForm.newReply} onChange={e=>setMaintainForm({...maintainForm, newReply:e.target.value})} rows="4" className="w-full p-4 border border-slate-200 rounded-2xl bg-blue-50/30 outline-none focus:ring-2 focus:ring-blue-500" placeholder="輸入新的答覆，或點擊上方按鈕複製罐頭文字貼上..."></textarea>
                         </div>
                       </form>
                     </div>
                     <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                       <button onClick={()=>setMaintainModal(null)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl mr-4 transition-colors">取消</button>
                       <button form="maintain-form" type="submit" disabled={currentUser.role === ROLES.VIEWER} className={`px-8 py-3 text-white rounded-xl font-black shadow-lg transition-all ${currentUser.role === ROLES.VIEWER ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5'}`}>{currentUser.role === ROLES.VIEWER ? '無維護權限' : '確認更新並寫入軌跡'}</button>
                     </div>
                   </div>
                 </div>
               )}
             </div>
          )}

          {/* TAB 2: LIST (歷史查詢區 Moved below MAINTENANCE) */}
          {activeTab === 'list' && (
             <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight shrink-0">歷史查詢區</h2>
                 
                 {/* 進階複合查詢篩選器與匯出按鈕 */}
                 <div className="flex flex-col md:flex-row w-full xl:w-auto gap-3">
                   {/* 匯出 Excel 按鈕 */}
                   <button 
                     onClick={handleExportExcel}
                     className="flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2.5 rounded-2xl shadow-sm hover:bg-green-700 transition-colors font-bold text-sm shrink-0"
                   >
                     <Download size={16} />
                     <span>匯出 Excel</span>
                   </button>

                   {/* Date Filter */}
                   <div className="flex items-center space-x-2 bg-white px-3 py-2.5 border border-slate-200 rounded-2xl shadow-sm shrink-0">
                     <Calendar size={16} className="text-slate-400"/>
                     <input type="date" value={historyStartDate} onChange={e=>setHistoryStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-32"/>
                     <span className="text-slate-300 text-xs">至</span>
                     <input type="date" value={historyEndDate} onChange={e=>setHistoryEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-32"/>
                   </div>
                   {/* Progress Filter */}
                   <select value={historyProgress} onChange={e=>setHistoryProgress(e.target.value)} className="bg-white px-4 py-2.5 border border-slate-200 rounded-2xl shadow-sm font-bold text-sm text-slate-700 outline-none shrink-0">
                     <option value="全部">全部進度</option>
                     {progresses.map(p=><option key={p} value={p}>{p}</option>)}
                   </select>
                   {/* Keyword Filter */}
                   <div className="relative flex-1 xl:w-72">
                     <Search size={18} className="absolute left-4 top-3 text-slate-400"/>
                     <input type="text" placeholder="搜尋案件號、院所或內容..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"/>
                   </div>
                 </div>
               </div>
               
               <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                 <div className="overflow-x-auto min-h-[400px]">
                   <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b text-[11px] font-black text-slate-400 uppercase tracking-widest">
                       <tr>
                         <SortHeader label="案件號/日期" sortKey="receiveTime" />
                         <SortHeader label="院所" sortKey="instName" />
                         <SortHeader label="描述/回覆摘要" sortKey="extraInfo" />
                         <SortHeader label="建立/負責人" sortKey="receiver" />
                         <SortHeader label="進度" sortKey="progress" align="center" />
                       </tr>
                     </thead>
                     <tbody className="divide-y text-sm font-medium">
                       {filteredAndSortedHistory.length === 0 ? (
                         <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold">查無符合條件的案件</td></tr>
                       ) : (
                         filteredAndSortedHistory.map(t=>(
                           <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                             <td className="p-5"><div className="font-black text-slate-800 font-mono text-xs">{t.ticketId || '-'}</div><div className="text-[10px] text-slate-400 mt-1">{new Date(t.receiveTime).toLocaleDateString()} / {t.channel}</div></td>
                             <td className="p-5"><div>{t.instName}</div><div className="text-[10px] font-mono text-slate-400 mt-1">{t.instCode}</div></td>
                             <td className="p-5 max-w-[250px]"><div className="truncate text-slate-600 mb-1" title={t.extraInfo}>問: {t.extraInfo || '-'}</div><div className="truncate text-slate-400 text-xs" title={t.replyContent}>答: {t.replyContent || '-'}</div></td>
                             <td className="p-5"><div className="text-slate-800">{t.receiver}</div>{t.assignee && <div className="text-[10px] text-blue-600 font-bold bg-blue-50 inline-block px-1.5 rounded mt-1">負責: {t.assignee}</div>}</td>
                             <td className="p-5 text-center"><span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase ${t.progress==='結案'?'bg-green-100 text-green-700':t.progress==='待處理'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700'}`}>{t.progress}</span></td>
                           </tr>
                         ))
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          )}

          {/* TAB 4: DASHBOARD (統計報表) */}
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">進階統計區</h2>
              
              {/* 原本三個重要數據復原，並改為靠右排版 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
                  <div className="text-slate-500 text-lg md:text-xl font-bold mb-2 text-right">總件數</div>
                  <div className="text-5xl font-black text-slate-900 leading-none text-right">{dashboardStats.total}</div>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
                  <div className="text-slate-500 text-lg md:text-xl font-bold mb-2 text-right">待處理件數</div>
                  <div className="text-5xl font-black text-red-500 leading-none text-right">{dashboardStats.pending}</div>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
                  <div className="text-slate-500 text-lg md:text-xl font-bold mb-2 text-right">完成率</div>
                  <div className="text-5xl font-black text-blue-600 leading-none text-right">{dashboardStats.completionRate}%</div>
                </div>
              </div>

              {/* 圖表區 1: 垂直長條圖 (自訂區間) */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">服務類別分佈</h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">區間數據獨立計算，不受其他圖表影響</p>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <Calendar size={16} className="text-slate-400 ml-2"/>
                    <input type="date" value={dashStartDate} onChange={e=>setDashStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"/>
                    <span className="text-slate-300">~</span>
                    <input type="date" value={dashEndDate} onChange={e=>setDashEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer mr-2"/>
                  </div>
                </div>
                
                <div className="flex h-[320px] items-end space-x-4 md:space-x-8 overflow-x-auto pb-4 pt-12 px-4">
                  {Object.entries(dashboardStats.categoryData).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => {
                    const maxVal = Math.max(...Object.values(dashboardStats.categoryData), 1);
                    const heightPct = (count / maxVal) * 100;
                    return (
                      <div key={cat} className="group flex flex-col items-center justify-end h-full w-12 shrink-0 relative">
                        <div className="absolute -top-8 text-slate-900 bg-slate-100 px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap z-10 shadow-sm">
                          {count} 件
                        </div>
                        <div className="w-10 bg-slate-100 rounded-t-full h-full flex flex-col justify-end overflow-hidden relative">
                          <div className="w-full bg-indigo-500 rounded-t-full transition-all duration-1000 ease-out" style={{ height: `${heightPct}%` }}></div>
                        </div>
                        <div className="text-[12px] font-bold text-slate-500 mt-4 h-32 text-center leading-tight [writing-mode:vertical-rl] group-hover:text-blue-600 transition-colors tracking-widest cursor-default select-none">
                          {cat}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 圖表區 2: 線型圖 (月趨勢) */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">近半年趨勢走勢圖</h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">觀測各類別每月份案件數量波動</p>
                  </div>
                  <select value={trendCategory} onChange={e=>setTrendCategory(e.target.value)} className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="全類別">-- 綜合全類別 --</option>
                    {categories.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <LineChart data={dashboardStats.trendDataArray} labels={dashboardStats.monthLabels.map(m => m.replace('-','/'))} />
              </div>

            </div>
          )}

          {/* TAB 5: SETTINGS (系統設定區) */}
          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">系統設定區</h2>

              {/* 個人密碼修改區 (所有角色可見) */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <h3 className="font-black text-lg mb-6 flex items-center text-slate-800"><Lock size={20} className="mr-2 text-indigo-600"/> 修改個人登入密碼</h3>
                <form onSubmit={handleChangeOwnPassword} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-2">新密碼</label>
                    <input type="password" required value={pwdChangeForm.newPwd} onChange={e=>setPwdChangeForm({...pwdChangeForm, newPwd: e.target.value})} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="輸入新密碼"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-2">確認新密碼</label>
                    <input type="password" required value={pwdChangeForm.confirmPwd} onChange={e=>setPwdChangeForm({...pwdChangeForm, confirmPwd: e.target.value})} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="再次輸入新密碼"/>
                  </div>
                  <button type="submit" className="py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95">更新密碼</button>
                </form>
                {pwdChangeMsg && <p className={`mt-4 text-sm font-bold ${pwdChangeMsg.includes('❌') ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>{pwdChangeMsg}</p>}
              </div>

              {/* 罐頭文字維護區 (管理員與一般使用者可見) */}
              {currentUser.role !== ROLES.VIEWER && (
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-8">
                  <h3 className="font-black text-lg mb-6 flex items-center text-slate-800"><MessageSquare size={20} className="mr-2 text-indigo-600"/> 罐頭文字維護</h3>
                  <p className="text-xs text-slate-500 mb-6">新增的文字將自動顯示在所有人的「新增紀錄」與「紀錄維護」彈窗面板中。</p>
                  <DropdownManager title="常用回覆範本" dbKey="cannedMessages" items={cannedMessages} />
                </div>
              )}

              {/* 以下功能僅管理員可見 */}
              {currentUser.role === ROLES.ADMIN && (
                <>
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-8">
                    <h3 className="font-black text-lg mb-6 flex items-center text-slate-800"><Shield size={20} className="mr-2 text-indigo-600"/> 使用者與權限管理</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* 新增使用者 */}
                      <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                        <h4 className="font-bold text-sm mb-4">建立新用戶</h4>
                        <form onSubmit={handleAddUser} className="space-y-4">
                          <input type="text" required placeholder="設定帳號 (將顯示為負責人)" value={newUser.username} onChange={e=>setNewUser({...newUser, username:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl font-medium outline-none"/>
                          <input type="password" required placeholder="設定初始密碼" value={newUser.password} onChange={e=>setNewUser({...newUser, password:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl font-medium outline-none"/>
                          <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
                            <option value={ROLES.USER}>{ROLES.USER} (可新增/維護紀錄)</option>
                            <option value={ROLES.VIEWER}>{ROLES.VIEWER} (僅能看不可改)</option>
                            <option value={ROLES.ADMIN}>{ROLES.ADMIN} (系統全權限)</option>
                          </select>
                          <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-md">新增用戶</button>
                        </form>
                      </div>
                      {/* 使用者清單 */}
                      <div className="overflow-auto border border-slate-200 rounded-[1.5rem] bg-white h-[320px]">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 sticky top-0 text-[10px] font-black uppercase text-slate-500 tracking-widest z-10">
                            <tr><th className="p-4">帳號</th><th className="p-4">權限</th><th className="p-4 text-center">密碼重置</th><th className="p-4 text-center">刪除</th></tr>
                          </thead>
                          <tbody className="divide-y text-sm font-medium">
                            {dbUsers.map(u => (
                              <tr key={u.id} className="hover:bg-slate-50">
                                <td className="p-4">{u.username}</td>
                                <td className="p-4"><span className="bg-slate-100 px-2.5 py-1 rounded-lg text-xs">{u.role}</span></td>
                                <td className="p-4 text-center">
                                  <button onClick={()=>handleResetUserPassword(u.id, u.username)} className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">重置</button>
                                </td>
                                <td className="p-4 text-center">
                                  {u.id !== currentUser.id && <button onClick={()=>handleDeleteUser(u.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 院所維護區 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className="space-y-8">
                      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="font-black mb-6 text-sm text-slate-800 uppercase tracking-widest flex items-center"><Plus size={18} className="mr-2 text-blue-600"/> 單筆新增院所</h3>
                        <form onSubmit={handleAddInst} className="space-y-4">
                          <input type="text" placeholder="代碼" value={newInst.code} onChange={e=>setNewInst({...newInst, code:e.target.value})} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-medium focus:ring-2 outline-none"/>
                          <input type="text" placeholder="名稱" value={newInst.name} onChange={e=>setNewInst({...newInst, name:e.target.value})} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-medium focus:ring-2 outline-none"/>
                          <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-colors">單筆存入</button>
                        </form>
                      </div>
                      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <h3 className="font-black mb-2 text-sm text-slate-800 uppercase tracking-widest flex items-center"><Upload size={18} className="mr-2 text-green-600"/> 批次匯入 (Excel)</h3>
                        <p className="text-[10px] text-slate-400 mb-6 font-bold">自動擷取 B 欄、D 欄、H 欄</p>
                        <div className="relative">
                          <input type="file" onChange={handleFileUpload} disabled={isImporting} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"/>
                          <button disabled={isImporting} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center hover:bg-green-700 disabled:bg-slate-300 transition-colors">
                            {isImporting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div> : <Upload size={18} className="mr-2"/>} 開始匯入
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm h-[700px] flex flex-col">
                      <div className="p-6 bg-slate-50/50 border-b flex justify-between items-center px-8">
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">雲端院所對照表 ({institutions.length.toLocaleString()} 筆)</h3>
                        {institutions.length > 0 && <button onClick={handleClearAllInsts} className="text-red-400 text-xs font-black uppercase tracking-tighter hover:text-red-600">清空全部資料庫</button>}
                      </div>
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white sticky top-0 border-b text-[10px] text-slate-400 font-black uppercase tracking-widest">
                            <tr><th className="p-5">代碼</th><th className="p-5">名稱</th><th className="p-5 text-center">刪除</th></tr>
                          </thead>
                          <tbody className="divide-y text-xs font-medium">
                            {filteredInsts.slice(0, 100).map(i=>(
                              <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-5 font-mono text-slate-500">{i.code}</td>
                                <td className="p-5 text-slate-800 font-bold">{i.name}</td>
                                <td className="p-5 text-center"><button onClick={()=>handleDeleteInst(i.id)} className="text-slate-200 hover:text-red-500"><Trash2 size={16}/></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 表單下拉選單維護 (移至最下方) */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="font-black text-lg mb-2 flex items-center text-slate-800"><Tags size={20} className="mr-2 text-indigo-600"/> 表單下拉選單維護</h3>
                    <p className="text-xs text-slate-500 mb-6 font-bold flex items-center"><AlertCircle size={14} className="mr-1 text-orange-500"/> 注意：系統預設以「結案」兩字作為完成率計算標準，建議保留此選項。</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                      <DropdownManager title="反映管道" dbKey="channels" items={channels} />
                      <DropdownManager title="業務類別" dbKey="categories" items={categories} />
                      <DropdownManager title="案件狀態" dbKey="statuses" items={statuses} />
                      <DropdownManager title="處理進度" dbKey="progresses" items={progresses} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Render Canned Modal in Root */}
          {showCannedModal && <CannedMessagesModal messages={cannedMessages} onClose={() => setShowCannedModal(false)} />}
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
