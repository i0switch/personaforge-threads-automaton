import './utils/ios-websocket-shim';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// 認証ハンドラーを初期化
import { authHandler } from './utils/authHandler';

console.log('🔐 AuthHandler initialized:', !!authHandler);

// React StrictModeを常に有効化（開発時の副作用検出のため）
const AppWrapper = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('🔧 StrictMode: Enabled (Best Practice)');

ReactDOM.createRoot(document.getElementById("root")!).render(AppWrapper);
