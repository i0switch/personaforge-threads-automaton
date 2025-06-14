import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PersonaSetup from "./pages/PersonaSetup";
import CreatePosts from "./pages/CreatePosts";
import ScheduledPosts from "./pages/ScheduledPosts";
import AutoReply from "./pages/AutoReply";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/persona-setup" element={<PersonaSetup />} />
          <Route path="/create-posts" element={<CreatePosts />} />
          <Route path="/scheduled-posts" element={<ScheduledPosts />} />
          <Route path="/auto-reply" element={<AutoReply />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
