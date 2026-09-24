export const formatNumber = (value) => Number(value || 0).toLocaleString('zh-TW');

export const formatRepliesHistory = (replies, fallbackContent) => {
  if (replies && replies.length > 0) {
    return replies
      .map((reply) => `${reply.content} (${reply.user} ${new Date(reply.time).toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })})`)
      .join('\n');
  }
  return fallbackContent || '';
};

export const getLatestReply = (replies, fallbackContent) => {
  if (replies && replies.length > 0) return replies[replies.length - 1].content;
  return fallbackContent || '';
};

// 舊版在「新增後保留結案進度」時可能漏寫 closeTime；createdAt 正是該筆按下儲存的時間。
export const resolveCloseTime = (ticket) => {
  if (!ticket || ticket.progress !== '結案') return '';
  return ticket.closeTime || ticket.createdAt || '';
};

export const getNiceChartScale = (rawMax, targetIntervals = 5) => {
  const safeMax = Math.max(Number(rawMax) || 0, 10);
  const roughStep = safeMax / targetIntervals;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const niceNormalizedStep = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10;
  const step = niceNormalizedStep * magnitude;
  const intervalCount = Math.ceil(safeMax / step);
  return {
    max: step * intervalCount,
    ticks: Array.from({ length: intervalCount + 1 }, (_, index) => index * step),
  };
};
