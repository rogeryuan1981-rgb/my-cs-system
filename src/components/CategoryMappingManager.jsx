import React, { useState } from 'react';
import { Plus, Menu, Trash2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';

/**
 * 下拉選單管理元件 (DropdownManager)
 * 用於在系統設定區管理各個動態選單項目的新增、刪除與拖曳排序
 */
const DropdownManager = ({ title, dbKey, items, showToast, showConfirm, db }) => {
  const [newItem, setNewItem] = useState('');
  const [draggedIdx, setDraggedIdx] = useState(null);
  const safeItems = Array.isArray(items) ? items : [];
  
  // 取得全域 appId (若於預覽環境)
  const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // 處理新增項目
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim() || safeItems.includes(newItem.trim())) return;
    
    const newArray = [...safeItems, newItem.trim()];
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      
      await setDoc(docRef, { [dbKey]: newArray }, { merge: true });
      setNewItem('');
      showToast(`成功新增：${newItem}`, 'success');
    } catch (error) {
      showToast(`新增失敗：${error.message}`, 'error');
    }
  };

  // 處理刪除項目
  const handleRemove = async (itemToRemove) => {
    if (!(await showConfirm(`確定要刪除「${itemToRemove}」嗎？`))) return;
    
    const newArray = safeItems.filter(i => i !== itemToRemove);
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      
      await setDoc(docRef, { [dbKey]: newArray }, { merge: true });
      showToast(`已刪除：${itemToRemove}`, 'success');
    } catch (error) {
      showToast(`刪除失敗：${error.message}`, 'error');
    }
  };

  // 處理拖曳排序 (Drag & Drop)
  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) return;
    
    const newItems = [...safeItems];
    const [moved] = newItems.splice(draggedIdx, 1);
    newItems.splice(dropIdx, 0, moved);
    
    try {
      const baseDbPath = typeof __app_id !== 'undefined' ? ['artifacts', currentAppId, 'public', 'data'] : [];
      const docRef = baseDbPath.length ? doc(db, ...baseDbPath, 'cs_settings', 'dropdowns') : doc(db, 'cs_settings', 'dropdowns');
      
      await setDoc(docRef, { [dbKey]: newItems }, { merge: true });
      setDraggedIdx(null);
    } catch (error) {
      showToast(`排序更新失敗：${error.message}`, 'error');
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 flex flex-col h-full">
      <h4 className="font-bold text-sm mb-4 text-slate-700 dark:text-slate-200">{title}</h4>
      
      {/* 新增表單 */}
      <form onSubmit={handleAdd} className="flex mb-4 gap-2 shrink-0">
        <input 
          type="text" 
          value={newItem} 
          onChange={e => setNewItem(e.target.value)} 
          className="flex-1 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
          placeholder="新增項目..."
        />
        <button type="submit" className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus size={18}/>
        </button>
      </form>
      
      {/* 項目列表 */}
      <ul className="space-y-2 overflow-y-auto flex-1 pr-2 min-h-[150px]">
        {safeItems.map((item, idx) => (
          <li 
            key={item} 
            draggable 
            onDragStart={(e) => { 
              setDraggedIdx(idx); 
              e.dataTransfer.effectAllowed = "move"; 
            }} 
            onDragOver={e => e.preventDefault()} 
            onDrop={(e) => handleDrop(e, idx)} 
            onDragEnd={() => setDraggedIdx(null)} 
            className={`flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm text-sm group transition-all ${draggedIdx === idx ? 'opacity-40 border-dashed border-indigo-400' : ''}`}
          >
            <div className="flex items-center flex-1 overflow-hidden">
              <div className="cursor-grab text-slate-300 hover:text-indigo-500 mr-2 p-1 active:cursor-grabbing">
                <Menu size={16} />
              </div>
              <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{item}</span>
            </div>
            <button 
              type="button" 
              onClick={() => handleRemove(item)} 
              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-2 transition-opacity"
            >
              <Trash2 size={16}/>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DropdownManager;
