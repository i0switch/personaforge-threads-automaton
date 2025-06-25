
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logConfigurationStatus } from "./utils/configValidation";

// Validate configuration before starting the app
try {
  logConfigurationStatus();
} catch (error) {
  console.error('Failed to start application:', error);
  // Show error to user instead of blank screen
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: red;">設定エラー</h1>
      <p>アプリケーションの設定に問題があります。開発者にお問い合わせください。</p>
      <details>
        <summary>詳細情報</summary>
        <pre style="background: #f5f5f5; padding: 10px; margin-top: 10px;">${error}</pre>
      </details>
    </div>
  `;
  throw error;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
