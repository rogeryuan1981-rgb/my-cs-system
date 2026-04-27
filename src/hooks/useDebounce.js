import { useState, useEffect } from 'react';

/**
 * 自訂的防抖 Hook (Debounce)
 * 用於延遲狀態的更新，避免在短時間內頻繁觸發運算（如：搜尋框打字）
 * * @param {any} value - 需要防抖的狀態值
 * @param {number} delay - 延遲時間（毫秒）
 * @returns {any} - 經過延遲後的狀態值
 */
export default function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // 設定一個計時器，在 delay 毫秒後更新狀態
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 清除函式：如果 value 在 delay 時間內再次改變，就會清除上一個計時器，重新計時
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
