import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// --- Firebase Initialization Config ---
// 這裡保留相容環境變數的寫法，方便您在不同環境中切換
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyBvIOc7J-0ID2F2mQv2_BaHThApPw3uVl0",
      authDomain: "customerservice-1f9c0.firebaseapp.com",
      projectId: "customerservice-1f9c0",
      storageBucket: "customerservice-1f9c0.firebasestorage.app",
      messagingSenderId: "34677415846",
      appId: "1:34677415846:web:880d8fafafbb66ad6fb967"
    };

// --- 初始化主要 Firebase App ---
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// 匯出當前的 appId 供部分全域邏輯使用
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- 初始化次要 Firebase App (Secondary App) ---
// 用途：供後台管理員建立新使用者帳號時使用，避免覆蓋掉當前管理員的登入狀態
let secondaryApp;
try { 
  secondaryApp = getApp('SecondaryApp'); 
} catch (e) { 
  secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp'); 
}
export const secondaryAuth = getAuth(secondaryApp);
