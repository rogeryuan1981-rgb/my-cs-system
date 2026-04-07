import React, { useState, useEffect, useMemo } from 'react';
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
// ⚠️ 請在此處填入您在 Firebase Console 第一階段取得的「專屬金鑰」內容
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

export default function App() {
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
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // 監聽紀錄
    const q = query(collection(db, 'cs_records'));
    const unsubscribeDb = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      records.sort((a, b) => new Date(b.receiveTime) - new Date(a.receiveTime));
      setTickets(records);
      setLoading(false);
    });

    // 監聽院所
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
          if (instMap[code] && typeof instMap[code] !== 'boolean') continue; 
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
    return institutions.filter(inst => inst.code.includes(instSearchTerm) || inst.name.includes(instSearchTerm));
  }, [institutions, instSearchTerm]);

  const dashboardStats = useMemo(() => {
    const total = tickets.length, resolved = tickets.filter(t => t.progress === '結案').length;
    const byChannel = { LINE: 0, 電話: 0 };
    tickets.forEach(t => { byChannel[t.channel] = (byChannel[t.channel] || 0) + 1; });
    return { total, resolved, byChannel };
  }, [tickets]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg"><PhoneCall size={24} /></div>
          <h1 className="text-xl font-bold text-slate-800">客服系統正式版</h1>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <button onClick={() => setActiveTab('form')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${activeTab === 'form' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}><Plus size={20}/> <span className="font-bold">新增紀錄</span></button>
          <button onClick={() => setActiveTab('list')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}><List size={20}/> <span className="font-bold">歷史查詢</span></button>
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}><LayoutDashboard size={20}/> <span className="font-bold">統計報表</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}><Settings size={20}/> <span className="font-bold">院所維護</span></button>
        </nav>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          {/* TAB 1: FORM */}
          {activeTab === 'form' && (
            <div className="animate-in fade-in space-y-6">
              <div className="mb-6"><h2 className="text-2xl font-black">建立新案件</h2><p className="text-slate-400 text-sm">正式營運版：所有資料均永久保存於 Firebase 雲端。</p></div>
              {submitStatus.msg && <div className={`p-4 rounded-xl flex items-center space-x-2 ${submitStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}><CheckCircle size={20}/><span>{submitStatus.msg}</span></div>}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold mb-4 flex items-center text-blue-600"><User size={20} className="mr-2"/> 聯絡管道與人員</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><label className="text-xs font-bold text-slate-400 uppercase">管道</label><select name="channel" value={formData.channel} onChange={handleChange} className="w-full mt-1 p-2.5 border rounded-xl bg-slate-50">
                      <option>電話</option><option>LINE</option></select></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">時間</label><div className="flex mt-1"><input type="datetime-local" name="receiveTime" value={formData.receiveTime} onChange={handleChange} className="flex-1 p-2.5 border rounded-l-xl"/><button type="button" onClick={()=>handleSetCurrentTime('receiveTime')} className="bg-slate-100 px-3 border border-l-0 rounded-r-xl"><Clock size={16}/></button></div></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">接收人員</label><input type="text" name="receiver" required value={formData.receiver} onChange={handleChange} className="w-full mt-1 p-2.5 border rounded-xl" placeholder="您的姓名"/></div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold mb-4 flex items-center text-blue-600"><Building2 size={20} className="mr-2"/> 院所比對</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><label className="text-xs font-bold text-slate-400 uppercase">院所代碼 (10碼)</label>
                      <div className="relative mt-1">
                        <input type="text" name="instCode" value={formData.instCode} onChange={handleChange} onBlur={handleInstCodeBlur} className="w-full p-2.5 border rounded-xl" placeholder="例如: 0101090517"/>
                        {isLookingUp && <div className="absolute right-3 top-3 animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>}
                      </div>
                    </div>
                    <div className="md:col-span-1"><label className="text-xs font-bold text-slate-400 uppercase">院所名稱</label><input type="text" name="instName" value={formData.instName} readOnly className="w-full mt-1 p-2.5 border rounded-xl bg-slate-50 text-slate-500"/></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">層級</label><input type="text" name="instLevel" value={formData.instLevel} readOnly className="w-full mt-1 p-2.5 border rounded-xl bg-slate-50 text-slate-500"/></div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold mb-4 flex items-center text-blue-600"><FileText size={20} className="mr-2"/> 案件內容</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div><label className="text-sm font-medium">類別</label><select name="category" value={formData.category} onChange={handleChange} className="w-full p-2.5 border rounded-xl">{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
                    <div><label className="text-sm font-medium">狀態</label><select name="status" value={formData.status} onChange={handleChange} className="w-full p-2.5 border rounded-xl">{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
                    <div><label className="text-sm font-medium">進度</label><select name="progress" value={formData.progress} onChange={handleChange} className="w-full p-2.5 border rounded-xl font-bold">{PROGRESS_OPTIONS.map(p=><option key={p}>{p}</option>)}</select></div>
                  </div>
                  <div className="space-y-4">
                    <textarea name="extraInfo" value={formData.extraInfo} onChange={handleChange} rows="3" className="w-full p-3 border rounded-xl" placeholder="問題詳情..."></textarea>
                    <textarea name="replyContent" value={formData.replyContent} onChange={handleChange} rows="3" className="w-full p-3 border rounded-xl bg-blue-50/20" placeholder="給予的答覆..."></textarea>
                  </div>
                </div>
                <div className="flex justify-end pb-12">
                  <button type="submit" disabled={submitStatus.type === 'loading'} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-bold flex items-center shadow-lg hover:bg-blue-700">
                    <Save size={20} className="mr-2"/> 儲存案件
                  </button>
                </div>
              </form>
            </div>
          )}
          {activeTab === 'list' && (
            <div className="animate-in fade-in space-y-6">
              <div className="flex justify-between items-center"><h2 className="text-2xl font-black">紀錄清單</h2><input type="text" placeholder="搜尋..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="p-2 border rounded-xl"/></div>
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden"><table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-xs font-bold"><tr><th className="p-4">日期</th><th className="p-4">院所</th><th className="p-4">描述</th><th className="p-4">進度</th></tr></thead>
                <tbody className="divide-y text-sm">
                  {tickets.filter(t=> (t.instName||'').includes(searchTerm)).map(t=>(
                    <tr key={t.id} className="hover:bg-slate-50"><td className="p-4">{new Date(t.receiveTime).toLocaleDateString()}</td><td className="p-4">{t.instName}</td><td className="p-4 truncate max-w-xs">{t.extraInfo}</td><td className="p-4"><span className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold">{t.progress}</span></td></tr>
                  ))}
                </tbody></table></div>
            </div>
          )}
          {activeTab === 'dashboard' && <div className="p-8 bg-white rounded-2xl border">案件總數：{dashboardStats.total} / 已結案：{dashboardStats.resolved}</div>}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm"><h3 className="font-bold mb-4">單筆新增</h3><form onSubmit={handleAddInst} className="space-y-4"><input type="text" placeholder="代碼" value={newInst.code} onChange={e=>setNewInst({...newInst, code:e.target.value})} className="w-full p-2.5 border rounded-xl"/><input type="text" placeholder="名稱" value={newInst.name} onChange={e=>setNewInst({...newInst, name:e.target.value})} className="w-full p-2.5 border rounded-xl"/><button type="submit" className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold">手動存入</button></form></div>
                <div className="bg-white p-6 rounded-2xl border shadow-sm"><h3 className="font-bold mb-2">批次匯入</h3><div className="relative"><input type="file" onChange={handleFileUpload} disabled={isImporting} className="absolute inset-0 opacity-0 cursor-pointer"/><button className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold">開始匯入</button></div></div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm h-[600px] flex flex-col">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold">雲端院所檔 ({institutions.length.toLocaleString()} 筆)</h3><button onClick={()=>setShowInstList(!showInstList)} className="text-blue-600 text-xs font-bold">{showInstList?'隱藏':'展開'}</button></div>
                {showInstList && <div className="flex-1 overflow-auto"><table className="w-full text-left text-xs divide-y"><tbody>{filteredInsts.slice(0, 100).map(i=>(<tr key={i.id}><td className="p-2">{i.code}</td><td className="p-2">{i.name}</td></tr>))}</tbody></table></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
