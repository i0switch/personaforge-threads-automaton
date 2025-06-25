
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [adminCheckState, setAdminCheckState] = useState<'loading' | 'admin' | 'not-admin' | 'error'>('loading');

  useEffect(() => {
    let mounted = true;

    const checkAdminAccess = async () => {
      // Wait for auth to complete
      if (authLoading) return;
      
      // Redirect to auth if no user
      if (!user) {
        if (mounted) {
          setAdminCheckState('not-admin');
          navigate("/auth", { replace: true });
        }
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        
        if (!mounted) return;
        
        if (error) {
          console.error('Admin check error:', error);
          setAdminCheckState('error');
          toast({
            title: "エラー",
            description: "権限確認に失敗しました。",
            variant: "destructive",
          });
          setTimeout(() => navigate("/", { replace: true }), 2000);
          return;
        }
        
        if (!data) {
          setAdminCheckState('not-admin');
          toast({
            title: "アクセス拒否",
            description: "管理者権限が必要です。",
            variant: "destructive",
          });
          setTimeout(() => navigate("/", { replace: true }), 2000);
          return;
        }
        
        setAdminCheckState('admin');
      } catch (error) {
        if (!mounted) return;
        
        console.error('Unexpected admin check error:', error);
        setAdminCheckState('error');
        toast({
          title: "エラー",
          description: "権限確認中に予期しないエラーが発生しました。",
          variant: "destructive",
        });
        setTimeout(() => navigate("/", { replace: true }), 2000);
      }
    };

    // Reset state when location changes
    if (location.pathname.includes('/admin')) {
      setAdminCheckState('loading');
      checkAdminAccess();
    }

    return () => {
      mounted = false;
    };
  }, [user, authLoading, navigate, toast, location.pathname]);

  // Show loading while checking auth or admin status
  if (authLoading || adminCheckState === 'loading') {
    return <LoadingSpinner message="権限を確認中..." />;
  }

  // Show children only if user is confirmed admin
  if (adminCheckState === 'admin') {
    return <>{children}</>;
  }

  // Show loading for redirect states
  const redirectMessage = 
    adminCheckState === 'not-admin' ? 'アクセスが拒否されました。リダイレクト中...' : 
    adminCheckState === 'error' ? 'エラーが発生しました。リダイレクト中...' : 
    'リダイレクト中...';

  return <LoadingSpinner message={redirectMessage} />;
};
