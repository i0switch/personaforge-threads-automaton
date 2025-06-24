
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, [user, authLoading]);

  const checkAdminAccess = async () => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
      
      if (error) throw error;
      
      if (!data) {
        toast({
          title: "アクセス拒否",
          description: "管理者権限が必要です。",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin access:', error);
      toast({
        title: "エラー",
        description: "権限確認に失敗しました。",
        variant: "destructive",
      });
      navigate("/");
    }
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">権限を確認中...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
};
