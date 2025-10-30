import './utils/ios-websocket-shim';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// 認証ハンドラーを初期化
import { authHandler } from './utils/authHandler';

console.log('🔐 AuthHandler initialized:', !!authHandler);

// 開発環境でのDOM競合を防ぐため、StrictModeを無効化
// 本番環境では元々StrictModeは使われないため、影響なし
const isDevelopment = import.meta.env.DEV;
const AppWrapper = isDevelopment ? (
  <App />
) : (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('🔧 StrictMode:', isDevelopment ? 'Disabled (Dev)' : 'Enabled (Prod)');

ReactDOM.createRoot(document.getElementById("root")!).render(AppWrapper);
