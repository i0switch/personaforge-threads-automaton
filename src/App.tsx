import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster"
import ReplyMonitoring from "@/pages/ReplyMonitoring";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import PersonaSetup from "@/pages/PersonaSetup";
import CreatePosts from "@/pages/CreatePosts";
import ReviewPosts from "@/pages/ReviewPosts";
import ScheduledPosts from "@/pages/ScheduledPosts";
import SchedulingDashboard from "@/pages/SchedulingDashboard";
import AutoReply from "@/pages/AutoReply";
import Settings from "@/pages/Settings";
import AdminDashboard from "@/pages/AdminDashboard";
import SecurityManagement from "@/pages/SecurityManagement";
import DevelopmentGuide from "@/pages/DevelopmentGuide";
import AutoPostMode from "@/pages/AutoPostMode";
import AutoPostWizard from "@/pages/AutoPostWizard";
import AutoPostSchedules from "@/pages/AutoPostSchedules";
import RandomPostConfig from "@/pages/RandomPostConfig";
import SelfReplySettings from "@/pages/SelfReplySettings";

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
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
                      path="/scheduling-dashboard"
                      element={
                        <ProtectedRoute>
                          <SchedulingDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/auto-post-mode"
                      element={
                        <ProtectedRoute>
                          <AutoPostMode />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/auto-post-mode/wizard"
                      element={
                        <ProtectedRoute>
                          <AutoPostWizard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/auto-post-mode/schedules"
                      element={
                        <ProtectedRoute>
                          <AutoPostSchedules />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/auto-post-mode/random"
                      element={
                        <ProtectedRoute>
                          <RandomPostConfig />
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
                    <Route
                      path="/security-management"
                      element={
                        <ProtectedAdminRoute>
                          <SecurityManagement />
                        </ProtectedAdminRoute>
                      }
                    />
                    <Route
                      path="/self-reply"
                      element={
                        <ProtectedRoute>
                          <SelfReplySettings />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/development-guide" element={<DevelopmentGuide />} />
                  </Routes>
                </main>
              </div>
            </Router>
          </div>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;