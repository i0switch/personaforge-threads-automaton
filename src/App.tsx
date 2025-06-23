
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster"
import ReplyMonitoring from "@/pages/ReplyMonitoring";

const queryClient = new QueryClient();

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gray-50">
          <Router>
            <div className="flex h-screen">
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <div className="p-6">
                          <h1 className="text-3xl font-bold">ダッシュボード</h1>
                          <p>アプリケーションへようこそ</p>
                        </div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reply-monitoring"
                    element={
                      <ProtectedRoute>
                        <ReplyMonitoring />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </main>
            </div>
          </Router>
        </div>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
