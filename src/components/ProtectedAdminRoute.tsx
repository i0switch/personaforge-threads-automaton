
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAdminAccess = async () => {
      // 認証完了まで待機
      if (authLoading) return;
      
      // ユーザーがいない場合は認証ページへ
      if (!user) {
        if (mounted) {
          navigate("/auth", { replace: true });
        }
        return;
      }

      try {
        // 管理者権限チェック
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        
        if (!mounted) return;
        
        if (error) {
          console.error('Admin check error:', error);
          
          // セキュリティログに記録
          await supabase
            .from('activity_logs')
            .insert({
              user_id: user.id,
              action_type: 'admin_check_failed',
              description: 'Failed to verify admin privileges',
              metadata: { error: error.message, ip: 'unknown' }
            });

          toast({
            title: "エラー",
            description: "権限確認に失敗しました。",
            variant: "destructive",
          });
          
          setTimeout(() => navigate("/", { replace: true }), 2000);
          return;
        }
        
        if (!data) {
          // 不正なアクセス試行をログに記録
          await supabase
            .from('activity_logs')
            .insert({
              user_id: user.id,
              action_type: 'unauthorized_admin_access',
              description: 'Attempted to access admin area without privileges',
              metadata: { 
                path: location.pathname, 
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent
              }
            });

          setIsAdmin(false);
          toast({
            title: "アクセス拒否",
            description: "管理者権限が必要です。",
            variant: "destructive",
          });
          
          setTimeout(() => navigate("/", { replace: true }), 2000);
          return;
        }
        
        // 管理者アクセスをログに記録
        await supabase
          .from('activity_logs')
          .insert({
            user_id: user.id,
            action_type: 'admin_access_granted',
            description: 'Successfully accessed admin area',
            metadata: { 
              path: location.pathname,
              timestamp: new Date().toISOString()
            }
          });

        setIsAdmin(true);
      } catch (error) {
        if (!mounted) return;
        
        console.error('Unexpected admin check error:', error);
        
        // 予期しないエラーをログに記録
        await supabase
          .from('activity_logs')
          .insert({
            user_id: user?.id || 'unknown',
            action_type: 'admin_check_error',
            description: 'Unexpected error during admin check',
            metadata: { 
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined
            }
          });

        toast({
          title: "エラー",
          description: "権限確認中に予期しないエラーが発生しました。",
          variant: "destructive",
        });
        
        setTimeout(() => navigate("/", { replace: true }), 2000);
      }
    };

    // 管理者ページにアクセスしたらチェック実行
    if (location.pathname.includes('/admin') || location.pathname.includes('/security-management')) {
      setIsAdmin(null);
      checkAdminAccess();
    }

    return () => {
      mounted = false;
    };
  }, [user, authLoading, navigate, toast, location.pathname]);

  // 認証中または管理者チェック中
  if (authLoading || isAdmin === null) {
    return <LoadingSpinner message="権限を確認中..." />;
  }

  // 管理者の場合のみ子コンポーネントを表示
  if (isAdmin) {
    return <>{children}</>;
  }

  // リダイレクト中は何も表示しない
  return null;
};
