
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PersonaSetup from "./pages/PersonaSetup";
import CreatePosts from "./pages/CreatePosts";
import ReviewPosts from "./pages/ReviewPosts";
import ScheduledPosts from "./pages/ScheduledPosts";
import AutoReply from "./pages/AutoReply";
import ReplyMonitoring from "./pages/ReplyMonitoring";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import SchedulingDashboard from "./pages/SchedulingDashboard";
import ImageGeneration from "./pages/ImageGeneration";
import SecurityManagement from "./pages/SecurityManagement";
import UserManual from "./pages/UserManual";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/user-manual" element={<UserManual />} />
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
              path="/reply-monitoring"
              element={
                <ProtectedRoute>
                  <ReplyMonitoring />
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
              path="/scheduling"
              element={
                <ProtectedRoute>
                  <SchedulingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/image-generation"
              element={
                <ProtectedRoute>
                  <ImageGeneration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/security"
              element={
                <ProtectedRoute>
                  <SecurityManagement />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
