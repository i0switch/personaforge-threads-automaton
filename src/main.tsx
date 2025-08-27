
import './utils/ios-websocket-shim';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// 認証ハンドラーを初期化
import { authHandler } from './utils/authHandler';

console.log('🔐 AuthHandler initialized:', !!authHandler);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
