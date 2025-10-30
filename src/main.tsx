import './utils/ios-websocket-shim';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// 認証ハンドラーを初期化
import { authHandler } from './utils/authHandler';
import { isWebSocketRestricted } from './utils/platform';

console.log('🔐 AuthHandler initialized:', !!authHandler);

// iOS/Safari環境では StrictMode を無効化（DOM操作の競合を防ぐため）
const AppWrapper = isWebSocketRestricted() ? (
  <App />
) : (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById("root")!).render(AppWrapper);
