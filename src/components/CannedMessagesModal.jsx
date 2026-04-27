import React, { useState } from 'react';
import { MessageSquare, X, Check, Copy } from 'lucide-react';

/**
 * 罐頭訊息彈窗元件 (CannedMessagesModal)
 * 用於在新增或維護案件時，快速複製常用的回覆文字
 */
const CannedMessagesModal = ({ messages, onClose, showToast }) => {
  const [copyId, setCopyId] = useState(null);
  
  const handleCopy = (text, idx) => {
    // 建立一個臨時的 textarea 來執行原生的複製指令，以相容各種瀏覽器環境
    const ta = document.createElement("textarea"); 
    ta.value = text; 
    document.body.appendChild(ta); 
    ta.select();
    
    try { 
      document.execCommand('copy'); 
      setCopyId(idx); 
      showToast('已複製到剪貼簿', 'success');
      // 延遲關閉視窗，讓使用者能看到打勾的綠色動畫
      setTimeout(() => { 
        setCopyId(null); 
        onClose(); 
      }, 500); 
    } catch (err) { 
      console.error('Copy failed', err); 
      showToast('複製失敗', 'error'); 
    }
    
    document.body.removeChild(ta);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <h3 className="font-black text-lg flex items-center text-slate-800 dark:text-slate-100">
            <MessageSquare size={20} className="mr-2 text-blue-600 dark:text-blue-400"/> 
            選擇罐頭回覆
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20}/>
          </button>
        </div>

        {/* 罐頭文字列表區 */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {(Array.isArray(messages) ? messages : []).map((m, idx) => (
            <div 
              key={idx} 
              className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all group relative cursor-pointer" 
              onClick={() => handleCopy(m, idx)}
            >
              <p className="text-sm text-slate-600 dark:text-slate-200 line-clamp-4 pr-6">{m}</p>
              <button className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400">
                {copyId === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          ))}
          
          {/* 無資料狀態 */}
          {(!messages || messages.length === 0) && (
            <p className="text-xs text-slate-400 text-center py-6">目前尚無設定任何罐頭文字。</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default CannedMessagesModal;
