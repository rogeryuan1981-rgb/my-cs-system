import React, { useState } from 'react';
import { ShieldAlert, Save, X } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * 強制修改密碼彈窗 (ForcePasswordChangeModal)
 * 當管理員建立新帳號並勾選「下次登入需修改密碼」時，使用者登入會強制顯示此視窗
 */
const ForcePasswordChangeModal = ({ activeUser, showToast, auth, db }) => {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPwd.length < 6) return showToast('密碼長度需至少 6 碼', 'error');
    if (newPwd !== confirmPwd) return showToast('兩次輸入密碼不符', 'error');

    setIsLoading(true);
    try {
      // 1. 更新 Firebase Auth 密碼
      await updatePassword(auth.currentUser, newPwd);
      // 2. 更新 Firestore 狀態，解除強制修改標記
      await updateDoc(doc(db, 'cs_users', activeUser.id), { requirePasswordChange: false });
      showToast('密碼修改成功！歡迎進入系統', 'success');
      // 頁面會因為 activeUser 狀態改變而自動重整或關閉彈窗
    } catch (error) {
      showToast('密碼更新失敗：' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md p-8 border-4 border-amber-400 dark:border-amber-500 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">安全安全性提醒</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">這是您第一次登入或密碼已被管理員重置，為了帳號安全，請先設定您的新密碼。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">設定新密碼</label>
            <input 
              type="password" required autoFocus 
              value={newPwd} onChange={e => setNewPwd(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
              placeholder="請輸入 6 碼以上新密碼"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">再次確認新密碼</label>
            <input 
              type="password" required 
              value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
              placeholder="請再次輸入密碼"
            />
          </div>
          <button 
            type="submit" disabled={isLoading}
            className="w-full py-4 bg-amber-500 text-white rounded-xl font-black hover:bg-amber-600 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full mr-2"></div> : <Save size={20} className="mr-2"/>}
            更新密碼並進入系統
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChangeModal;
