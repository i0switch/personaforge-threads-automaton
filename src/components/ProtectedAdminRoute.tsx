
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
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // デバッグ用のログ
  console.log('ProtectedAdminRoute render:', {
    user: user ? user.id : 'null',
    authLoading,
    isAdmin,
    checkingAdmin
  });

  useEffect(() => {
    checkAdminAccess();
  }, [user, authLoading]);

  const checkAdminAccess = async () => {
    console.log('checkAdminAccess called:', { authLoading, user: user ? user.id : 'null' });
    
    if (authLoading) {
      console.log('Auth still loading, returning early');
      return;
    }
    
    if (!user) {
      console.log('No user found, redirecting to auth');
      navigate("/auth");
      return;
    }

    try {
      setCheckingAdmin(true);
      console.log('Checking admin access for user:', user.id);
      
      const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
      
      if (error) {
        console.error('Error checking admin access:', error);
        throw error;
      }
      
      console.log('Admin check result:', data);
      
      if (!data) {
        console.log('User is not admin, showing error and redirecting');
        setIsAdmin(false);
        toast({
          title: "アクセス拒否",
          description: "管理者権限が必要です。",
          variant: "destructive",
        });
        // リダイレクト前に少し遅延を追加してトーストが表示されるのを確保
        setTimeout(() => {
          console.log('Redirecting non-admin user to home');
          navigate("/");
        }, 1500); // 遅延を少し長くしてトーストが確実に表示されるようにする
        return;
      }
      
      console.log('User is admin, allowing access');
      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin access:', error);
      setIsAdmin(false);
      toast({
        title: "エラー",
        description: "権限確認に失敗しました。",
        variant: "destructive",
      });
      setTimeout(() => {
        console.log('Redirecting due to error');
        navigate("/");
      }, 1500);
    } finally {
      console.log('Setting checkingAdmin to false');
      setCheckingAdmin(false);
    }
  };

  // 認証が読み込み中の場合
  if (authLoading) {
    console.log('Showing auth loading screen');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">認証確認中...</p>
        </div>
      </div>
    );
  }

  // 管理者チェック中の場合
  if (checkingAdmin) {
    console.log('Showing admin check loading screen');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">権限を確認中...</p>
        </div>
      </div>
    );
  }

  // ユーザーがいない（リダイレクト中）
  if (!user) {
    console.log('Showing no user redirect screen');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">リダイレクト中...</p>
        </div>
      </div>
    );
  }

  // 管理者でない（リダイレクト中）
  if (isAdmin === false) {
    console.log('Showing non-admin redirect screen');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">アクセスが拒否されました。リダイレクト中...</p>
        </div>
      </div>
    );
  }

  // 管理者チェックがまだ完了していない
  if (isAdmin === null) {
    console.log('isAdmin is null, showing loading screen');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">権限を確認中...</p>
        </div>
      </div>
    );
  }

  console.log('Rendering children - user is admin');
  return <>{children}</>;
};
