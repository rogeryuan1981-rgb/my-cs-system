import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Phone, MessageCircle, Clock, Save, FileText, BarChart3, 
  Search, CheckCircle, AlertCircle, User, Building2, 
  List, LayoutDashboard, Plus, X, PhoneCall,
  Settings, Trash2, Upload, Database
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, writeBatch } from 'firebase/firestore';

// --- Firebase Initialization (正式上線版) ---
// ⚠️ 請務必將以下欄位替換成您在 Firebase Console 取得的專屬內容！
const firebaseConfig = {
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

// --- Constants ---
const CATEGORIES = [
  "慢防-成人預防保健", "慢防-BC肝炎檢查", "婦幼-兒童預防保健", 
  "婦幼-兒童發展篩檢", "癌防-大腸癌篩檢", "癌防-胃幽門螺旋桿菌服務", 
  "癌防-乳房攝影", "癌防-子宮頸抹片檢查", "其他", "其他(業務外)"
];

const STATUS_OPTIONS = [
  "系統本身異常/問題", "詢問步驟", "詢問推播內容", 
  "開通帳號權限", "詢問服務資格", "核扣問題", "其他"
];

const PROGRESS_OPTIONS = ["待處理", "處理中", "待回覆", "結案"];

// --- Utility Functions ---
const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};

const getInitialForm = (currentUser = null) => ({
  receiveTime: getFormatDate(),
  callEndTime: '',
  channel: '電話',
  receiver: currentUser?.displayName || currentUser?.email || localStorage.getItem('cs_receiver_name') || '',
  instCode: '',
  instName: '',
  instLevel: '',
  category: '其他',
  status: '詢問步驟',
  extraInfo: '',
  questioner: '',
  replyContent: '',
  closeTime: '',
  progress: '待處理',
  notes: ''
});

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('form');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const [institutions, setInstitutions] = useState([]);
  const [instMap, setInstMap] = useState({});
  const [newInst, setNewInst] = useState({ code: '', name: '', level: '診所' });
  const [instSubmitMsg, setInstSubmitMsg] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [xlsxLoaded, setXlsloaded] = useState(false);
  const [showInstList, setShowInstList] = useState(false);
  const [instSearchTerm, setInstSearchTerm] = useState('');
  const [formData, setFormData] = useState(getInitialForm());
  const [isLookingUp, setIsLookingUp] = useState(false);

  useEffect(() => {
    if (!document.getElementById('xlsx-script')) {
      const script = document.createElement('script');
      script.id = 'xlsx-script';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => setXlsloaded(true);
      document.body.appendChild(script);
    } else {
      setXlsloaded(true);
    }

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setFormData(prev => ({
          ...prev,
          receiver: prev.receiver || currentUser.displayName || currentUser.email || localStorage.getItem('cs_receiver_name') || ''
        }));
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'cs_records'));
    const unsubscribeDb = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      records.sort((a, b) => new Date(b.receiveTime) - new Date(a.receiveTime));
      setTickets(records);
      setLoading(false);
    });

    const qInst = query(collection(db, 'mohw_institutions'));
    const unsubscribeInst = onSnapshot(qInst, (snapshot) => {
      let instList = [];
      const map = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isChunk && data.payload) {
          try {
            const parsed = JSON.parse(data.payload);
            parsed.forEach(item => {
              instList.push({ id: doc.id, isChunk: true, ...item });
              map[item.code] = { name: item.name, level: item.level };
            });
          } catch (e) { console.error(e); }
        } else {
          instList.push({ id: doc.id, isChunk: false, ...data });
          map[data.code] = { name: data.name, level: data.level };
        }
      });
      setInstitutions(instList);
      setInstMap(map);
    });

    return () => { unsubscribeDb(); unsubscribeInst(); };
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };
    if (name === 'progress' && value === '結案' && !formData.closeTime) {
      newFormData.closeTime = getFormatDate();
    }
    if (name === 'progress' && value !== '結案' && formData.closeTime) {
      newFormData.closeTime = '';
    }
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
        setFormData(prev => ({
          ...prev,
          instCode: rawCode.length < 10 ? paddedCode : rawCode,
          instName: data.name,
          instLevel: data.level
        }));
      } else {
        setFormData(prev => ({ ...prev, instName: '查無資料，請確認代碼或手動新增', instLevel: '' }));
      }
      setIsLookingUp(false);
    }, 400);
  };

  const handleSetCurrentTime = (field) => {
    setFormData(prev => ({ ...prev, [field]: getFormatDate() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      setSubmitStatus({ type: 'loading', msg: '儲存中...' });
      localStorage.setItem('cs_receiver_name', formData.receiver);
      await addDoc(collection(db, 'cs_records'), {
        ...formData,
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });
      setSubmitStatus({ type: 'success', msg: '紀錄已成功儲存！' });
      setFormData(getInitialForm(user));
      setTimeout(() => setSubmitStatus({ type: '', msg: '' }), 3000);
    } catch (error) {
      setSubmitStatus({ type: 'error', msg: '儲存失敗。' });
    }
  };

  const handleAddInst = async (e) => {
    e.preventDefault();
    if (!user || !newInst.code || !newInst.name) return;
    const paddedCode = newInst.code.trim().padStart(10, '0');
    try {
      await addDoc(collection(db, 'mohw_institutions'), { code: paddedCode, name: newInst.name, level: newInst.level });
      setNewInst({ code: '', name: '', level: '診所' });
      setInstSubmitMsg('新增成功！');
      setTimeout(() => setInstSubmitMsg(''), 3000);
    } catch (error) { console.error(error); }
  };

  const handleDeleteInst = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'mohw_institutions', id)); } catch (e) { console.error(e); }
  };

  const handleClearAllInsts = async () => {
    if (!user || !window.confirm('確定要清空所有院所資料嗎？')) return;
    setIsImporting(true);
    try {
      const batch = writeBatch(db);
      institutions.forEach(inst => batch.delete(doc(db, 'mohw_institutions', inst.id)));
      await batch.commit();
      setInstSubmitMsg('已清空。');
    } catch (e) { console.error(e); }
    finally { setIsImporting(false); }
  };

  const handleFileUpload = async (e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    setIsImporting(true);
    setInstSubmitMsg('解析中...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        const levelMapping = { '1': '醫學中心', '2': '區域醫院', '3': '地區醫院', '4': '診所', '5': '藥局', '6': '居家護理', '7': '康復之家', '8': '助產所', '9': '檢驗所', 'A': '物理治療所', 'B': '特約醫事放射機構', 'X': '不詳' };
        const CHUNK_SIZE = 4000;
        let currentChunk = [], chunks = [], added = 0;
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[1] || !row[3]) continue;
          const code = String(row[1]).trim().padStart(10, '0');
          if (instMap[code]) continue;
          const levelRaw = row[7] ? String(row[7]).trim().toUpperCase() : 'X';
          currentChunk.push({ code, name: String(row[3]).trim(), level: levelMapping[levelRaw] || '其他' });
          instMap[code] = true;
          added++;
          if (currentChunk.length >= CHUNK_SIZE) { chunks.push(currentChunk); currentChunk = []; }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk);
        for (const chunkData of chunks) {
          const batch = writeBatch(db);
          batch.set(doc(collection(db, 'mohw_institutions')), { isChunk: true, payload: JSON.stringify(chunkData) });
          await batch.commit();
        }
        setInstSubmitMsg(`匯入完成！新增 ${added} 筆。`);
      } catch (error) { setInstSubmitMsg('匯入出錯。'); }
      finally { setIsImporting(false); e.target.value = null; }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredInsts = useMemo(() => {
    if (!instSearchTerm) return institutions;
    return institutions.filter(inst => (inst.code||'').includes(instSearchTerm) || (inst.name||'').includes(instSearchTerm));
  }, [institutions, instSearchTerm]);

  const dashboardStats = useMemo(() => {
    const total = tickets.length, resolved = tickets.filter(t => t.progress === '結案').length;
    const byChannel = { LINE: 0, 電話: 0 };
    tickets.forEach(t => { byChannel[t.channel] = (byChannel[t.channel] || 0) + 1; });
    return { total, resolved, byChannel };
  }, [tickets]);

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
          <h1 className="text-xl font-black text-slate-800 tracking-tight">客服系統正式版</h1>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <NavButton id="form" icon={Plus} label="新增紀錄" />
          <NavButton id="list" icon={List} label="歷史查詢" />
          <NavButton id="dashboard" icon={LayoutDashboard} label="統計報表" />
          <NavButton id="settings" icon={Settings} label="院所維護" />
        </nav>
        <div className="p-6 border-t border-slate-50 text-[10px] text-slate-300 font-mono">
          SYSTEM ONLINE | {user ? 'SYNC ON' : 'SYNC OFF'}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50 relative">
        <div className="p-4 md:p-10 max-w-6xl mx-auto">
          
          {/* TAB 1: FORM */}
          {activeTab === 'form' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">建立新案件</h2>
                <div className="flex items-center mt-2 text-slate-400 space-x-2">
                  <span className="text-sm">正式營運版：雲端同步中。</span>
                </div>
              </div>

              {submitStatus.msg && (
                <div className={`p-4 rounded-2xl flex items-center space-x-3 border ${
                  submitStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                  <CheckCircle size={20}/>
                  <span className="font-bold">{submitStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Section 1 */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 tracking-wide uppercase text-sm">
                    <User size={18} className="mr-2"/> 聯絡管道與人員
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">管道</label>
                      <select name="channel" value={formData.channel} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                        <option>電話</option><option>LINE</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">時間</label>
                      <div className="flex group">
                        <input type="datetime-local" name="receiveTime" value={formData.receiveTime} onChange={handleChange} className="flex-1 p-3.5 border border-slate-200 rounded-l-2xl bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"/>
                        <button type="button" onClick={()=>handleSetCurrentTime('receiveTime')} className="bg-slate-100 px-4 border border-l-0 border-slate-200 rounded-r-2xl hover:bg-slate-200 transition-colors text-slate-500"><Clock size={18}/></button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">接收人員</label>
                      <input type="text" name="receiver" required value={formData.receiver} onChange={handleChange} className="w-full p-3.5 border border-slate-200 rounded-2xl bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none" placeholder="您的姓名"/>
                    </div>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 tracking-wide uppercase text-sm">
                    <Building2 size={18} className="mr-2"/> 院所比對
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">院所代碼 (10碼)</label>
                      <div className="relative">
                        <input type="text" name="instCode" value={formData.instCode} onChange={handleChange} onBlur={handleInstCodeBlur} className="w-full p-3.5 border border-slate-200 rounded-2xl font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="例如: 0101090517"/>
                        {isLookingUp && <div className="absolute right-4 top-4 animate-spin w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full"></div>}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">院所名稱</label>
                      <input type="text" name="instName" value={formData.instName} readOnly className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-500 font-bold"/>
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">層級</label>
                      <input type="text" name="instLevel" value={formData.instLevel} readOnly className="w-full p-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-500 font-bold"/>
                    </div>
                  </div>
                </div>

                {/* Section 3 */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
                  <h3 className="font-black mb-6 flex items-center text-blue-600 tracking-wide uppercase text-sm">
                    <FileText size={18} className="mr-2"/> 案件內容
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div><label className="text-xs font-bold mb-2 block">類別</label><select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-2xl">{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
                    <div><label className="text-xs font-bold mb-2 block">狀態</label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-3 border border-slate-200 rounded-2xl">{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div><label className="text-xs font-bold mb-2 block">進度</label><select name="progress" value={formData.progress} onChange={handleChange} className={`w-full p-3 border border-slate-200 rounded-2xl font-black ${formData.progress === '結案' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>{PROGRESS_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></div>
                  </div>
                  <div className="space-y-6">
                    <textarea name="extraInfo" value={formData.extraInfo} onChange={handleChange} rows="4" className="w-full p-5 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/30" placeholder="問題詳情..."></textarea>
                    <textarea name="replyContent" value={formData.replyContent} onChange={handleChange} rows="4" className="w-full p-5 border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/20" placeholder="給予的答覆..."></textarea>
                  </div>
                </div>

                <div className="flex justify-end pt-4 pb-12">
                  <button type="submit" disabled={submitStatus.type === 'loading'} className="px-14 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black flex items-center shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none">
                    {submitStatus.type === 'loading' ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div> : <Save size={22} className="mr-3"/>} 
                    儲存案件
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 其餘分頁：保持一致的高品質設計 */}
          {activeTab === 'list' && (
             <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight">紀錄清單</h2>
                 <div className="relative w-full md:w-80">
                   <Search size={18} className="absolute left-4 top-3.5 text-slate-400"/>
                   <input type="text" placeholder="快速搜尋關鍵字..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"/>
                 </div>
               </div>
               <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b text-[11px] font-black text-slate-400 uppercase tracking-widest">
                       <tr><th className="p-5">日期/管道</th><th className="p-5">院所</th><th className="p-5">描述</th><th className="p-5 text-center">進度</th></tr>
                     </thead>
                     <tbody className="divide-y text-sm font-medium">
                       {tickets.filter(t=> (t.instName||'').includes(searchTerm) || (t.extraInfo||'').includes(searchTerm)).map(t=>(
                         <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                           <td className="p-5"><div className="font-black text-slate-800">{new Date(t.receiveTime).toLocaleDateString()}</div><div className="text-[10px] text-slate-400 mt-1">{t.channel}</div></td>
                           <td className="p-5"><div>{t.instName}</div><div className="text-[10px] font-mono text-slate-400 mt-1">{t.instCode}</div></td>
                           <td className="p-5 max-w-xs truncate text-slate-600">{t.extraInfo || '(未填寫內容)'}</td>
                           <td className="p-5 text-center"><span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase ${t.progress==='結案'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>{t.progress}</span></td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">總受理案件</div>
                <div className="text-5xl font-black text-slate-900 leading-none">{dashboardStats.total}</div>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">已結案數</div>
                <div className="text-5xl font-black text-green-600 leading-none">{dashboardStats.resolved}</div>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">當前解決率</div>
                <div className="text-5xl font-black text-blue-600 leading-none">{dashboardStats.total ? Math.round((dashboardStats.resolved/dashboardStats.total)*100) : 0}%</div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="font-black mb-6 text-sm text-slate-800 uppercase tracking-widest flex items-center"><Plus size={18} className="mr-2 text-blue-600"/> 單筆新增</h3>
                  <form onSubmit={handleAddInst} className="space-y-4">
                    <input type="text" placeholder="代碼" value={newInst.code} onChange={e=>setNewInst({...newInst, code:e.target.value})} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"/>
                    <input type="text" placeholder="名稱" value={newInst.name} onChange={e=>setNewInst({...newInst, name:e.target.value})} className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"/>
                    <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all">手動存入</button>
                    {instSubmitMsg && <p className="text-center text-xs text-blue-600 font-bold animate-pulse">{instSubmitMsg}</p>}
                  </form>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="font-black mb-2 text-sm text-slate-800 uppercase tracking-widest flex items-center"><Upload size={18} className="mr-2 text-green-600"/> 批次匯入</h3>
                  <p className="text-[10px] text-slate-400 mb-6 font-bold">擷取 B 欄、D 欄、H 欄</p>
                  <div className="relative">
                    <input type="file" onChange={handleFileUpload} disabled={isImporting} className="absolute inset-0 opacity-0 cursor-pointer"/>
                    <button disabled={isImporting} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center hover:bg-green-700 transition-all">
                      {isImporting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div> : <Upload size={18} className="mr-2"/>} 
                      開始匯入
                    </button>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm h-[700px] flex flex-col">
                <div className="p-6 bg-slate-50/50 border-b flex justify-between items-center px-8">
                  <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">雲端院所檔 ({institutions.length.toLocaleString()} 筆)</h3>
                  <div className="flex space-x-4">
                    <button onClick={()=>setShowInstList(!showInstList)} className="text-blue-600 text-xs font-black uppercase tracking-tighter hover:underline">{showInstList?'隱藏清單':'展開瀏覽'}</button>
                    {institutions.length > 0 && <button onClick={handleClearAllInsts} className="text-red-400 text-xs font-black uppercase tracking-tighter hover:text-red-600">清空全部</button>}
                  </div>
                </div>
                {showInstList ? (
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
                            <td className="p-5 text-center"><button onClick={()=>handleDeleteInst(i.id)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredInsts.length > 100 && <div className="p-6 text-center text-[10px] text-slate-300 font-bold italic">清單僅顯示前 100 筆。</div>}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                    <Database size={80} className="opacity-5 mb-4"/>
                    <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Ready for lookup</p>
                  </div>
                )}
              </div>
            </div>
          )}
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
