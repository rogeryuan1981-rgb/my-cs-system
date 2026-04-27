import React, { useState, useEffect, useMemo } from 'react';
import { User, Settings, Camera, UserPlus, MessageSquare, Timer, Calendar, Trash2, Shield, Plus, Upload, List, AlertCircle } from 'lucide-react';
import { updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, addDoc, collection, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

// 依照您的嚴格指示，此處保持標準的模組化 import，忽略預覽環境的缺檔報錯，請確保您的本地端有這些檔案。
import useDebounce from '../hooks/useDebounce';
import Pagination from './Pagination';
import UserAvatar from './UserAvatar';
import DropdownManager from './DropdownManager';
import CategoryMappingManager from './CategoryMappingManager';
import { getEmailFromUsername } from '../utils/helpers';

const PAGE_SIZE = 50;

/**
 * 系統設定區元件 (SettingsArea)
 * 負責處理個人設定、系統參數、帳號管理、院所匯入與下拉選單配置
 */
const SettingsArea = ({
  currentUser,
  activeUser,
  dbUsers,
  userMap,
  channels,
  categories,
  statuses,
  progresses,
  cannedMessages,
  categoryMapping,
  overdueHours,
  holidays,
  institutions,
  instMap,
  auth,
  db,
  storage,
  functions,
  secondaryAuth,
  appId,
  ROLES,
  showToast,
  customConfirm,
  customAlert,
  customPrompt
}) => {
  // --- 頁籤與基礎狀態 ---
  const [settingsTab, setSettingsTab] = useState('general');
  
  // --- 一般設定狀態 ---
  const [pwdChangeForm, setPwdChangeForm] = useState({ newPwd: '', confirmPwd: '' });
  const [pwdChangeMsg, setPwdChangeMsg] = useState('');
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', delegate: '' });
  
  useEffect(() => {
    if (activeUser) {
      setLeaveForm({
        start: activeUser.leaveStart || '',
        end: activeUser.leaveEnd || '',
        delegate: activeUser.delegateUser || ''
      });
    }
  }, [activeUser]);

  // --- 系統設定狀態 ---
  const [localOverdueHours, setLocalOverdueHours] = useState(24);
  useEffect(() => { setLocalOverdueHours(overdueHours); }, [overdueHours]);
  
  const [isTriggering, setIsTriggering] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ start: '', end: '', note: '' });
  const [newUser, setNewUser] = useState({ username: '', password: '', role: ROLES.USER, lineUserId: '' });
  
  // 院所管理狀態
  const [newInst, setNewInst] = useState({ code: '', name: '', level: '診所' });
  const [isImporting, setIsImporting] = useState(false);
  const [instSearchTerm, setInstSearchTerm] = useState('');
  const debouncedInstSearchTerm = useDebounce(instSearchTerm, 300);
  const [instPage, setInstPage] = useState(1);

  useEffect(() => { setInstPage(1); }, [debouncedInstSearchTerm]);

  const filteredInsts = useMemo(() => {
    return institutions.filter(inst => 
      (inst.code || '').includes(debouncedInstSearchTerm) || 
      (inst.name || '').includes(debouncedInstSearchTerm)
    );
  }, [institutions, debouncedInstSearchTerm]);

  const paginatedInsts = useMemo(() => {
    return filteredInsts.slice((instPage - 1) * PAGE_SIZE, instPage * PAGE_SIZE);
  }, [filteredInsts, instPage]);

  // ================= 處理邏輯 (一般設定) =================
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !activeUser || !file.type.startsWith('image/')) return showToast('請上傳圖片檔案！', 'error');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150; 
        let width = img.width; 
        let height = img.height;
        
        if (width > height) { 
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
        } else { 
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } 
        }
        
        canvas.width = width; 
        canvas.height = height;
        const ctx = canvas.getContext('2d'); 
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
          const storageRef = ref(storage, `avatars/${appId}/${activeUser.id}_${Date.now()}.jpg`);
          await uploadString(storageRef, dataUrl, 'data_url');
          const downloadUrl = await getDownloadURL(storageRef);
          await updateDoc(doc(db, 'cs_users', activeUser.id), { photoURL: downloadUrl });
          showToast('個人圖像更新成功！', 'success');
        } catch (error) { 
          showToast('圖像更新失敗：' + error.message, 'error'); 
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file); 
    e.target.value = null; 
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    if (pwdChangeForm.newPwd !== pwdChangeForm.confirmPwd) return setPwdChangeMsg('❌ 兩次密碼不一致！');
    try {
      await updatePassword(auth.currentUser, pwdChangeForm.newPwd);
      setPwdChangeMsg('✅ 密碼更新成功！下次登入請使用新密碼。'); 
      setPwdChangeForm({ newPwd: '', confirmPwd: '' }); 
      setTimeout(() => setPwdChangeMsg(''), 5000);
    } catch (e) { 
      setPwdChangeMsg('❌ 密碼更新失敗：' + e.message); 
    }
  };

  const handleSaveLeave = async (e) => {
    e.preventDefault();
    if (leaveForm.start && leaveForm.end && leaveForm.start > leaveForm.end) return showToast("請假開始日期不能晚於結束日期", "error");
    if ((leaveForm.start || leaveForm.end) && !leaveForm.delegate) return showToast("請選擇案件代理人", "error");
    try {
      await updateDoc(doc(db, 'cs_users', activeUser.id), {
        leaveStart: leaveForm.start,
        leaveEnd: leaveForm.end,
        delegateUser: leaveForm.delegate
      });
      showToast('代理人設定已儲存成功！', 'success');
    } catch (error) {
      showToast('儲存代理失敗：' + error.message, 'error');
    }
  };

  const handleClearLeave = async () => {
    if (!(await customConfirm("確定要清除代理人設定並恢復自己接收通知嗎？"))) return;
    try {
      await updateDoc(doc(db, 'cs_users', activeUser.id), { leaveStart: '', leaveEnd: '', delegateUser: '' });
      setLeaveForm({ start: '', end: '', delegate: '' });
      showToast('已成功解除代理設定！', 'success');
    } catch (error) {
      showToast('清除失敗：' + error.message, 'error');
    }
  };

  // ================= 處理邏輯 (系統參數設定) =================
  const handleSaveOverdueHours = async () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try {
      await setDoc(doc(db, 'cs_settings', 'dropdowns'), { overdueHours: localOverdueHours }, { merge: true });
      showToast("逾期判定時數已成功更新！", "success");
    } catch (e) { showToast("更新失敗：" + e.message, "error"); }
  };

  const handleManualTrigger = async () => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!(await customConfirm("確定要現在「立即掃描並發送」逾期通知嗎？\n(只會發送給目前符合條件且「今天尚未通知過」的案件負責人)"))) return;
    
    setIsTriggering(true);
    try {
      const triggerFn = httpsCallable(functions, 'manualTriggerOverdue');
      const res = await triggerFn();
      await customAlert(`手動執行完畢！🎉\n本次共發送給 ${res.data.notifiedCount} 位同仁，並成功標記了 ${res.data.markedCount} 筆案件。`);
    } catch (error) {
      showToast("觸發失敗，請確認後端是否已更新成功：" + error.message, "error");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!newHoliday.start || !newHoliday.end || !newHoliday.note) return showToast("請填寫完整放假資訊", "error");
    if (newHoliday.start > newHoliday.end) return showToast("開始日期不能晚於結束日期", "error");
    try {
      const updatedHolidays = [...holidays, newHoliday].sort((a,b) => a.start.localeCompare(b.start));
      await setDoc(doc(db, 'cs_settings', 'dropdowns'), { holidays: updatedHolidays }, { merge: true });
      setNewHoliday({ start: '', end: '', note: '' });
      showToast('國定假日新增成功！', 'success');
    } catch(e) { showToast("新增假日失敗：" + e.message, "error"); }
  };

  const handleRemoveHoliday = async (idx) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (!(await customConfirm("確定要刪除此假日設定嗎？"))) return;
    try {
      const newHolidays = holidays.filter((_, i) => i !== idx);
      await setDoc(doc(db, 'cs_settings', 'dropdowns'), { holidays: newHolidays }, { merge: true });
      showToast("已成功刪除假日", "success");
    } catch (e) { showToast("刪除失敗：" + e.message, "error"); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (dbUsers.some(u => u.username === newUser.username)) return showToast('帳號名稱已存在', 'error');
    if (newUser.password.length < 6) return showToast('密碼長度至少需要 6 個字元！', 'error');
    try {
      const email = getEmailFromUsername(newUser.username);
      await createUserWithEmailAndPassword(secondaryAuth, email, newUser.password);
      await secondaryAuth.signOut();

      await addDoc(collection(db, 'cs_users'), { 
        username: newUser.username, 
        role: newUser.role, 
        createdAt: new Date().toISOString(), 
        region: '',
        lineUserId: newUser.lineUserId.trim(),
        requirePasswordChange: true 
      });
      setNewUser({ username: '', password: '', role: ROLES.USER, lineUserId: '' });
      showToast('用戶建立成功！', 'success');
    } catch(e) { 
        showToast('新增失敗：' + e.message, 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    if (await customConfirm('確定要停用此使用者嗎？\n(注意：前端僅能移除系統存取權，底層 Auth 需至 Firebase 後台處理)')) {
      await deleteDoc(doc(db, 'cs_users', id));
      showToast('使用者已刪除', 'success');
    }
  };

  const handleUpdateUserRegion = async (id, regionValue) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try { await updateDoc(doc(db, 'cs_users', id), { region: regionValue.trim() }); } 
    catch (e) { console.error("更新地區失敗", e); }
  };

  const handleUpdateUserLineId = async (id, lineIdValue) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    try { await updateDoc(doc(db, 'cs_users', id), { lineUserId: lineIdValue.trim() }); } 
    catch (e) { console.error("更新 LINE UID 失敗", e); }
  };

  const handleAddInst = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== ROLES.ADMIN && currentUser?.role !== ROLES.USER) return;
    const paddedCode = newInst.code.trim().padStart(10, '0');
    try {
      await addDoc(collection(db, 'mohw_institutions'), { code: paddedCode, name: newInst.name, level: newInst.level });
      setNewInst({ code: '', name: '', level: '診所' }); 
      showToast('單筆新增成功！', 'success'); 
    } catch (e) {}
  };

  const handleDeleteInst = async (id) => {
    if (currentUser?.role !== ROLES.ADMIN) return;
    await deleteDoc(doc(db, 'mohw_institutions', id));
  };

  const handleClearAllInsts = async () => {
    if (currentUser?.role !== ROLES.ADMIN || !(await customConfirm('確定要清空所有院所資料嗎？'))) return;
    setIsImporting(true);
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (let i = 0; i < institutions.length; i++) {
        batch.delete(doc(db, 'mohw_institutions', institutions[i].id));
        count++;
        if (count === 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
      }
      if (count > 0) await batch.commit();
      showToast('院所資料已清空', 'success');
    } catch (e) {} finally { setIsImporting(false); }
  };

  const handleFileUpload = async (e) => {
    if (currentUser?.role !== ROLES.ADMIN && currentUser?.role !== ROLES.USER) return;
    const file = e.target.files[0];
    if (!file || !window.XLSX) return showToast("請確認檔案格式或 Excel 模組是否載入", "error");
    
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
        
        for (const chunkData of chunks) {
          const batch = writeBatch(db);
          batch.set(doc(collection(db, 'mohw_institutions')), { isChunk: true, payload: JSON.stringify(chunkData) });
          await batch.commit();
        }
        showToast('院所資料批次匯入成功', 'success');
      } catch (error) { 
        showToast('匯入失敗：' + error.message, 'error'); 
      } finally { 
        setIsImporting(false); 
        e.target.value = null; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-8 max-w-[1400px] mx-auto">
      {/* 頂部導航與標題 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">系統設定區</h2>
        {currentUser?.role === ROLES.ADMIN && (
          <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button 
              onClick={() => setSettingsTab('general')} 
              className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center ${settingsTab === 'general' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <User size={16} className="mr-2"/>一般設定
            </button>
            <button 
              onClick={() => setSettingsTab('system')} 
              className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center ${settingsTab === 'system' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <Settings size={16} className="mr-2"/>系統參數設定
            </button>
          </div>
        )}
      </div>

      {/* ===================== 一般設定頁籤 ===================== */}
      {(settingsTab === 'general' || currentUser?.role !== ROLES.ADMIN) && (
        <>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100">
              <User size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 個人帳號設定
            </h3>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center space-y-4 p-6 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] bg-slate-50 dark:bg-slate-700/30 shrink-0 w-full md:w-48">
                <UserAvatar username={activeUser?.username} photoURL={activeUser?.photoURL} className="w-20 h-20 text-3xl" />
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
                  {(Array.isArray(dbUsers)?dbUsers:[]).filter(u => u.username !== activeUser?.username && u.role === ROLES.USER).map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                </select>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-md active:scale-95 text-sm">儲存代理</button>
                <button type="button" onClick={handleClearLeave} className="px-6 py-4 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 text-sm shadow-sm">清除</button>
              </div>
            </form>
          </div>

          {currentUser?.role !== ROLES.VIEWER && (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
              <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><MessageSquare size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 罐頭文字維護</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">新增的文字將自動顯示在所有人的「新增紀錄」與「紀錄維護」彈窗面板中。</p>
              <DropdownManager title="常用回覆範本" dbKey="cannedMessages" items={cannedMessages} showToast={showToast} showConfirm={customConfirm} db={db} />
            </div>
          )}
        </>
      )}

      {/* ===================== 系統參數設定頁籤 ===================== */}
      {settingsTab === 'system' && currentUser?.role === ROLES.ADMIN && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
          
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><Timer size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 系統逾期參數設定</h3>
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">逾期判定時數 (小時)：</label>
              <input type="number" min="1" value={localOverdueHours} onChange={e => setLocalOverdueHours(Number(e.target.value))} className="w-full md:w-32 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
              <button onClick={handleSaveOverdueHours} className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black text-sm transition-all">儲存參數</button>
              <button onClick={handleManualTrigger} disabled={isTriggering} className="w-full md:w-auto px-6 py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-md font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center">
                {isTriggering ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> : null}
                強制觸發推播
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">設定後，維護區內未結案且超過此時數的案件，將會顯示閃爍紅色的「逾期」提示標籤。</p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><Calendar size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 國定假日與停發推播區間</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">設定的期間內，系統不會自動發送推播通知，並且在計算案件逾期時數時會「自動扣除」這些天數。</p>
            
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
                  {(Array.isArray(holidays)?holidays:[]).length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold">目前無設定任何國定假日</td></tr> : holidays.map((h, idx) => (
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

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-black text-lg mb-6 flex items-center text-slate-800 dark:text-slate-100"><Shield size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 使用者與權限管理</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-sm mb-4 dark:text-slate-200">建立新用戶</h4>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <input type="text" required placeholder="設定帳號" value={newUser.username} onChange={e=>setNewUser({...newUser, username:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl font-medium outline-none"/>
                  <input type="password" required placeholder="設定初始密碼" value={newUser.password} onChange={e=>setNewUser({...newUser, password:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl font-medium outline-none"/>
                  <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold outline-none">
                    <option value={ROLES.USER}>{ROLES.USER}</option>
                    <option value={ROLES.VIEWER}>{ROLES.VIEWER}</option>
                    <option value={ROLES.ADMIN}>{ROLES.ADMIN}</option>
                  </select>
                  <input type="text" placeholder="綁定 LINE UID (U開頭... 非必填)" value={newUser.lineUserId || ''} onChange={e=>setNewUser({...newUser, lineUserId:e.target.value})} className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl font-medium outline-none"/>
                  <button type="submit" className="w-full py-3.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-black hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-md">新增用戶</button>
                </form>
              </div>
              <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-[1.5rem] bg-white dark:bg-slate-800 h-[320px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest z-10">
                    <tr><th className="p-4">帳號/頭像</th><th className="p-4">權限</th><th className="p-4">群組歸屬</th><th className="p-4">LINE UID</th><th className="p-4 text-center">刪除</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm font-medium">
                    {(Array.isArray(dbUsers)?dbUsers:[]).map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="p-4 flex items-center space-x-3 dark:text-slate-200"><UserAvatar username={u.username} photoURL={u.photoURL} className="w-8 h-8 text-xs shrink-0" /><span>{u.username}</span></td>
                        <td className="p-4"><span className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs">{u.role}</span></td>
                        <td className="p-4">
                          {u.role === ROLES.USER ? (
                            <input type="text" defaultValue={u.region || ''} onBlur={(e) => handleUpdateUserRegion(u.id, e.target.value)} placeholder="輸入群組..." className="w-full min-w-[80px] p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs"/>
                          ) : <span className="text-slate-400 dark:text-slate-500 text-xs italic font-bold">不適用</span>}
                        </td>
                        <td className="p-4">
                          {u.role === ROLES.USER ? (
                            <input type="text" defaultValue={u.lineUserId || ''} onBlur={(e) => handleUpdateUserLineId(u.id, e.target.value)} placeholder="輸入 LINE UID..." className="w-full min-w-[120px] p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono"/>
                          ) : <span className="text-slate-400 dark:text-slate-500 text-xs italic font-bold">不適用</span>}
                        </td>
                        <td className="p-4 text-center">{u.id !== currentUser?.id && <button onClick={()=>handleDeleteUser(u.id)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"><Trash2 size={16}/></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

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
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-6 font-bold">自動擷取 B、D、H 欄</p>
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
                {(Array.isArray(institutions)?institutions:[]).length > 0 && <button onClick={handleClearAllInsts} className="text-red-400 text-xs font-black uppercase tracking-tighter hover:text-red-600">清空全部</button>}
              </div>
              <div className="flex-1 overflow-auto flex flex-col">
                <table className="w-full text-left border-collapse flex-1">
                  <thead className="bg-white dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest z-10">
                    <tr><th className="p-5">代碼</th><th className="p-5">名稱</th><th className="p-5 text-center">刪除</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs font-medium">
                    {paginatedInsts.map(i=>(
                      <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-5 font-mono text-slate-500 dark:text-slate-400">{i.code}</td>
                        <td className="p-5 text-slate-800 dark:text-slate-200 font-bold">{i.name}</td>
                        <td className="p-5 text-center"><button onClick={()=>handleDeleteInst(i.id)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination currentPage={instPage} totalCount={filteredInsts.length} pageSize={PAGE_SIZE} onPageChange={setInstPage} />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
            <h3 className="font-black text-lg mb-2 flex items-center text-slate-800 dark:text-slate-100"><List size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 表單下拉選單維護</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-bold flex items-center"><AlertCircle size={14} className="mr-1 text-orange-500 dark:text-orange-400"/> 提示：按住項目左側的把手圖示可拖曳調整順序。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
              <DropdownManager title="反映管道" dbKey="channels" items={channels} showToast={showToast} showConfirm={customConfirm} db={db} />
              <DropdownManager title="業務類別" dbKey="categories" items={categories} showToast={showToast} showConfirm={customConfirm} db={db} />
              <DropdownManager title="案件狀態" dbKey="statuses" items={statuses} showToast={showToast} showConfirm={customConfirm} db={db} />
              <DropdownManager title="處理進度" dbKey="progresses" items={progresses} showToast={showToast} showConfirm={customConfirm} db={db} />
            </div>
          </div>
          
          <CategoryMappingManager categories={categories} mapping={categoryMapping} showToast={showToast} db={db} />
        </div>
      )}
    </div>
  );
};

export default SettingsArea;
