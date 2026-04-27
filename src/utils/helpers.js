// 定義系統中的角色常數
export const ROLES = { 
  ADMIN: "後台管理者", 
  USER: "一般使用者", 
  VIEWER: "紀錄檢視者" 
};

// 取得格式化後的日期時間 (YYYY-MM-DDTHH:mm)
export const getFormatDate = (date = new Date()) => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzOffset)).toISOString().slice(0, 16);
};

// 取得當月第一天 (YYYY-MM-DD)
export const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// 取得當月最後一天 (YYYY-MM-DD)
export const getLastDayOfMonth = () => {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

// 取得今天日期 (YYYY-MM-DD)
export const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 將使用者名稱轉換為系統內部的虛擬 Email
export const getEmailFromUsername = (username) => {
  return `${encodeURIComponent(username).replace(/%/g, '_')}@cs.local`.toLowerCase();
};

// 取得新增紀錄的初始表單狀態
export const getInitialForm = (username = '', channelsArr = [], progressesArr = []) => ({
  receiveTime: getFormatDate(), 
  callEndTime: '', 
  channel: Array.isArray(channelsArr) && channelsArr.length > 0 ? channelsArr[0] : '',
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
  progress: Array.isArray(progressesArr) && progressesArr.length > 0 ? progressesArr[0] : '待處理', 
  assignee: '', 
  replies: [], 
  editLogs: []
});

// 格式化對話回覆歷史紀錄 (用於 Excel 匯出或顯示)
export const formatRepliesHistory = (replies, fallbackContent) => {
  if (replies && replies.length > 0) {
    return replies.map(r => `${r.content} (${r.user} ${new Date(r.time).toLocaleString()})`).join('\n');
  }
  return fallbackContent || '';
};

// 取得最後一筆回覆內容
export const getLatestReply = (replies, fallbackContent) => {
  if (replies && replies.length > 0) return replies[replies.length - 1].content;
  return fallbackContent || '';
};
