import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * 強制修改密碼彈窗元件 (ForcePasswordChangeModal)
 * 當系統偵測到使用者 requirePasswordChange 為 true 時顯示，強制要求設定新密碼
 */
const ForcePasswordChangeModal = ({ activeUser, showToast, auth, db }) => {
  const [pwdForm, setPwdForm] = useState({ newPwd: '', confirmPwd: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleForceUpdate = async (e) => {
    e.preventDefault();
    if (pwdForm.newPwd.length < 6) return showToast('密碼長度至少需要 6 個字元', 'error');
    if (pwdForm.newPwd !== pwdForm.confirmPwd) return showToast('兩次密碼不一致', 'error');
    
    setIsUpdating(true);
    try {
      // 1. 更新 Firebase Auth 核心密碼
      await updatePassword(auth.currentUser, pwdForm.newPwd);
      
      // 2. 更新 Firestore 中使用者的狀態，解除強制修改標記
      await updateDoc(doc(db, 'cs_users', activeUser.id), { 
        requirePasswordChange: false 
      });
      
      showToast('密碼修改成功！歡迎使用系統', 'success');
    } catch (error) { 
      showToast('修改失敗：' + error.message, 'error'); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-red-100 dark:border-red-900/50 relative overflow-hidden flex flex-col">
        {/* 頂部紅色裝飾線 */}
        <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
        
        <div className="text-center mb-8">
          <div className="bg-red-100 dark:bg-red-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-600 dark:text-red-400"/>
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">為了您的帳號安全</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            系統偵測到您是首次登入，請立即設定您的專屬新密碼以啟用系統功能。
          </p>
        </div>

        <form onSubmit={handleForceUpdate} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">設定新密碼</label>
            <input 
              type="password" 
              required 
              value={pwdForm.newPwd} 
              onChange={e => setPwdForm({...pwdForm, newPwd: e.target.value})} 
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium" 
              placeholder="最少 6 個字元"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-300 block mb-2">確認新密碼</label>
            <input 
              type="password" 
              required 
              value={pwdForm.confirmPwd} 
              onChange={e => setPwdForm({...pwdForm, confirmPwd: e.target.value})} 
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium" 
              placeholder="再次輸入新密碼"
            />
          </div>
          <button 
            type="submit" 
            disabled={isUpdating} 
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black disabled:opacity-50 transition-colors shadow-md"
          >
            {isUpdating ? '更新中...' : '確認修改並啟用'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChangeModal;
