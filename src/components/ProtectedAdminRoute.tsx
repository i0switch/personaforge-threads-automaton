
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [adminState, setAdminState] = useState<'loading' | 'admin' | 'not-admin' | 'error'>('loading');
  const mountedRef = useRef(true);
  const checkedRef = useRef(false);

  console.log('ProtectedAdminRoute render:', {
    user: user ? user.id : 'null',
    authLoading,
    adminState,
    location: location.pathname,
    hasChecked: checkedRef.current
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // 認証ロード中または既にチェック済みの場合は何もしない
    if (authLoading || checkedRef.current) {
      return;
    }

    const checkAdminAccess = async () => {
      console.log('Starting admin access check:', { authLoading, user: user ? user.id : 'null' });
      
      if (authLoading) {
        console.log('Auth still loading, skipping check');
        return;
      }
      
      // ユーザーがいない場合は認証ページへリダイレクト
      if (!user) {
        console.log('No user found, redirecting to auth');
        checkedRef.current = true;
        if (mountedRef.current) {
          setAdminState('not-admin');
          // 少し遅延してリダイレクト
          setTimeout(() => {
            if (mountedRef.current) {
              navigate("/auth", { replace: true });
            }
          }, 100);
        }
        return;
      }

      try {
        console.log('Checking admin access for user:', user.id);
        
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        
        if (error) {
          console.error('Error checking admin access:', error);
          throw error;
        }
        
        console.log('Admin check result:', data);
        checkedRef.current = true;
        
        if (!mountedRef.current) return;
        
        if (!data) {
          console.log('User is not admin, showing error and redirecting');
          setAdminState('not-admin');
          toast({
            title: "アクセス拒否",
            description: "管理者権限が必要です。",
            variant: "destructive",
          });
          
          setTimeout(() => {
            if (mountedRef.current) {
              console.log('Redirecting non-admin user to home');
              navigate("/", { replace: true });
            }
          }, 1500);
          return;
        }
        
        console.log('User is admin, allowing access');
        setAdminState('admin');
      } catch (error) {
        console.error('Error checking admin access:', error);
        checkedRef.current = true;
        
        if (!mountedRef.current) return;
        
        setAdminState('error');
        toast({
          title: "エラー",
          description: "権限確認に失敗しました。",
          variant: "destructive",
        });
        
        setTimeout(() => {
          if (mountedRef.current) {
            console.log('Redirecting due to error');
            navigate("/", { replace: true });
          }
        }, 1500);
      }
    };

    checkAdminAccess();
  }, [user, authLoading, navigate, toast]);

  // ロケーション変更時にチェック状態をリセット（戻るボタン対応）
  useEffect(() => {
    if (location.pathname === '/admin') {
      checkedRef.current = false;
      setAdminState('loading');
    }
  }, [location.pathname]);

  // 認証がロード中の場合
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
  if (adminState === 'loading') {
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

  // 管理者の場合のみ子コンポーネントを表示
  if (adminState === 'admin') {
    console.log('Rendering children - user is admin');
    return <>{children}</>;
  }

  // その他の場合（リダイレクト中、エラー等）はローディング表示
  console.log('Showing redirect/error loading screen');
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">
          {adminState === 'not-admin' ? 'アクセスが拒否されました。リダイレクト中...' : 
           adminState === 'error' ? 'エラーが発生しました。リダイレクト中...' : 
           'リダイレクト中...'}
        </p>
      </div>
    </div>
  );
};
