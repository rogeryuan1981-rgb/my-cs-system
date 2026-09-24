import { getFormatDate } from './date';

export const getEmailFromUsername = (username) => `${encodeURIComponent(username).replace(/%/g, '_')}@cs.local`.toLowerCase();

export const normalizeInstitutionCode = (value) => {
  const code = String(value || '').trim();
  if (code === '000' || code === '999') return code;
  return code.padStart(10, '0');
};

export const findInstitutionByCode = (value, institutionMap = {}) => {
  const code = String(value || '').trim();
  if (code === '000') return institutionMap['000'] || institutionMap['0000000000'];
  return institutionMap[code] || institutionMap[normalizeInstitutionCode(code)];
};

export const isAllowedInstitutionCode = (value, institutionMap = {}) => {
  const code = String(value || '').trim();
  if (code === '999') return true;
  if (code === '000') return Boolean(findInstitutionByCode(code, institutionMap));
  return /^[A-Za-z0-9]{10}$/.test(code);
};

export const getInitialForm = (username = '', channels = [], progresses = [], defaultIsCorrection = false) => ({
  receiveTime: getFormatDate(),
  callEndTime: '',
  channel: Array.isArray(channels) && channels.length > 0 ? channels[0] : '',
  receiver: username,
  instCode: '',
  instName: '',
  instLevel: '',
  category: '',
  status: '',
  isCorrection: Boolean(defaultIsCorrection),
  extraInfo: '',
  questioner: '',
  replyContent: '',
  closeTime: '',
  progress: Array.isArray(progresses) && progresses.length > 0 ? progresses[0] : '待處理',
  assignee: '',
  replies: [],
  editLogs: [],
});

export const normalizeCannedMessages = (messages) => (Array.isArray(messages) ? messages : []).map((item, index) => {
  if (typeof item === 'string') {
    return { id: `legacy-${index}`, status: '', question: item, answer: item };
  }
  return {
    id: item.id || `canned-${index}`,
    status: item.status || '',
    question: item.question || '',
    answer: item.answer || '',
  };
});
