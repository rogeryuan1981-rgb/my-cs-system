import React from 'react';

/**
 * 使用者頭像元件 (UserAvatar)
 * 用於顯示使用者的照片，若無照片則顯示預設的字母字首頭像
 */
const UserAvatar = ({ username, photoURL, className = "w-8 h-8 text-xs" }) => {
  // 若有上傳大頭貼，直接顯示圖片
  if (photoURL) {
    return (
      <img 
        src={photoURL} 
        alt={username} 
        className={`rounded-full object-cover shadow-sm border border-slate-200 dark:border-slate-600 ${className}`} 
      />
    );
  }
  
  // 若無大頭貼，顯示預設的藍色圓形與字母
  return (
    <div className={`rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shrink-0 shadow-sm border border-blue-200 dark:border-blue-800 ${className}`}>
      {username ? username.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

export default UserAvatar;
