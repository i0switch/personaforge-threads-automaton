
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { Toaster } from "@/components/ui/toaster"
import ReplyMonitoring from "@/pages/ReplyMonitoring";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import PersonaSetup from "@/pages/PersonaSetup";
import CreatePosts from "@/pages/CreatePosts";
import ReviewPosts from "@/pages/ReviewPosts";
import ScheduledPosts from "@/pages/ScheduledPosts";
import AutoReply from "@/pages/AutoReply";
import Settings from "@/pages/Settings";
import AdminDashboard from "@/pages/AdminDashboard";

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
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/persona-setup"
                    element={
                      <ProtectedRoute>
                        <PersonaSetup />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/create-posts"
                    element={
                      <ProtectedRoute>
                        <CreatePosts />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/review-posts"
                    element={
                      <ProtectedRoute>
                        <ReviewPosts />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/scheduled-posts"
                    element={
                      <ProtectedRoute>
                        <ScheduledPosts />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/auto-reply"
                    element={
                      <ProtectedRoute>
                        <AutoReply />
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
                  <Route
                    path="/admin"
                    element={
                      <ProtectedAdminRoute>
                        <AdminDashboard />
                      </ProtectedAdminRoute>
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
