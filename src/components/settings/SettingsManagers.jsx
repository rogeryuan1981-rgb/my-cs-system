import React, { useEffect, useState } from 'react';
import { Database, Menu, MessageSquare, Plus, Save, Trash2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { appId, db } from '../../config/firebase';
import { normalizeCannedMessages } from '../../utils/tickets';

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
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { [dbKey]: newItems }, { merge: true });
      setDraggedIdx(null);
    } catch (error) {
      showToast('排序更新失敗：' + error.message, 'error');
    }
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

const CannedReplyManager = ({ items, statuses, showToast, showConfirm }) => {
  const [localItems, setLocalItems] = useState([]);
  useEffect(() => setLocalItems(normalizeCannedMessages(items)), [items]);

  const updateItem = (index, field, value) => {
    setLocalItems(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setLocalItems(prev => [...prev, {
      id: `canned-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: Array.isArray(statuses) && statuses.length > 0 ? statuses[0] : '',
      question: '',
      answer: ''
    }]);
  };

  const saveItems = async (nextItems = localItems, validateCompleteness = true) => {
    const normalizedItems = nextItems.map(item => ({
      id: item.id,
      status: String(item.status || '').trim(),
      question: String(item.question || '').trim(),
      answer: String(item.answer || '').trim()
    }));
    const incomplete = normalizedItems.find(item => !item.status || !item.question || !item.answer);
    if (validateCompleteness && incomplete) {
      showToast('每組罐頭內容都必須選擇案件狀態，並填寫問題敘述與答覆。', 'error');
      return false;
    }
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { cannedMessages: normalizedItems }, { merge: true });
      showToast('罐頭問題與答覆已儲存！');
      return true;
    } catch (error) {
      showToast('儲存罐頭內容失敗：' + error.message, 'error');
      return false;
    }
  };

  const removeItem = (index) => {
    const target = localItems[index];
    showConfirm(`確定要刪除「${target?.question || '此組罐頭內容'}」嗎？`, async () => {
      const nextItems = localItems.filter((_, itemIndex) => itemIndex !== index);
      const saved = await saveItems(nextItems, false);
      if (saved) setLocalItems(nextItems);
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100"><MessageSquare size={20} className="mr-2 text-indigo-600 dark:text-indigo-400"/> 罐頭問題與答覆設定</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">每個案件狀態可設定多組一對一的「問題敘述＋初步答覆」。</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={addItem} className="px-5 py-3 bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-600 font-black text-sm flex items-center"><Plus size={16} className="mr-1"/>新增組合</button>
          <button type="button" onClick={() => saveItems()} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black text-sm"><Save size={16} className="inline mr-1"/>儲存全部</button>
        </div>
      </div>
      <div className="space-y-5">
        {localItems.map((item, index) => (
          <div key={item.id} className="relative grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-4 p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">案件狀態</label>
              <select value={item.status} onChange={e => updateItem(index, 'status', e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                <option value="">請選擇狀態</option>
                {(Array.isArray(statuses) ? statuses : []).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">罐頭問題敘述</label>
              <textarea value={item.question} onChange={e => updateItem(index, 'question', e.target.value)} rows="3" placeholder="輸入詳細問題描述…" className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">罐頭問題答覆</label>
              <textarea value={item.answer} onChange={e => updateItem(index, 'answer', e.target.value)} rows="3" placeholder="輸入對應的初步答覆…" className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
            </div>
            <button type="button" onClick={() => removeItem(index)} className="absolute top-3 right-3 p-2 bg-white dark:bg-slate-800 text-slate-300 hover:text-red-500 rounded-lg shadow-sm transition-colors" title="刪除此組"><Trash2 size={16}/></button>
          </div>
        ))}
        {localItems.length === 0 && <div className="py-12 text-center text-sm font-bold text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-2xl">尚未設定罐頭問題與答覆，請點選「新增組合」。</div>}
      </div>
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

const StatusHintManager = ({ statuses, hints, showToast }) => {
  const [localHints, setLocalHints] = useState({});
  useEffect(() => setLocalHints(hints || {}), [hints]);

  const handleSaveHints = async () => {
    try {
      const cleanedHints = {};
      (Array.isArray(statuses) ? statuses : []).forEach(status => {
        const hint = String(localHints[status] || '').trim();
        if (hint) cleanedHints[status] = hint;
      });
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', appId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      await setDoc(docRef, { statusHints: cleanedHints }, { merge: true });
      showToast('案件狀態提示文字已儲存！');
    } catch (error) {
      showToast('儲存案件狀態提示失敗：' + error.message, 'error');
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 mt-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h4 className="font-black text-slate-800 dark:text-slate-100 flex items-center"><MessageSquare size={18} className="mr-2 text-indigo-600"/> 案件狀態提示文字設定</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">提示支援多行文字；前台選定案件狀態後，將滑鼠移到該欄位即可查看。</p>
        </div>
        <button type="button" onClick={handleSaveHints} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md font-black text-sm shrink-0">儲存提示文字</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Array.isArray(statuses) ? statuses : []).map(status => (
          <div key={status} className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
            <label className="text-sm font-black text-slate-700 dark:text-slate-200 block mb-2">{status}</label>
            <textarea
              value={localHints[status] || ''}
              onChange={e => setLocalHints(prev => ({ ...prev, [status]: e.target.value }))}
              rows="3"
              placeholder={`輸入「${status}」的前台提示內容…`}
              className="w-full p-3 text-sm leading-relaxed bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none resize-y placeholder-slate-400"
            />
          </div>
        ))}
        {(!Array.isArray(statuses) || statuses.length === 0) && <p className="text-sm text-slate-400 font-bold py-4">請先在上方新增案件狀態。</p>}
      </div>
    </div>
  );
};

export { DropdownManager, CannedReplyManager, CategoryMappingManager, StatusHintManager };
