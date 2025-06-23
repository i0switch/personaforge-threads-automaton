import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient } from "react-query";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Posts from "./pages/Posts";
import Personas from "./pages/Personas";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster"

import ReplyMonitoring from "@/pages/ReplyMonitoring";

function App() {
  return (
    <AuthProvider>
      <QueryClient>
        <div className="min-h-screen bg-gray-50">
          <Router>
            <div className="flex h-screen">
              <Sidebar />
              
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/posts"
                    element={
                      <ProtectedRoute>
                        <Posts />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/personas"
                    element={
                      <ProtectedRoute>
                        <Personas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
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
      </QueryClient>
    </AuthProvider>
  );
}

export default App;
