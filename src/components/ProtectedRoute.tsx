
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  // 認証中のみローディング表示
  if (loading) {
    return <LoadingSpinner message="認証確認中..." />;
  }

  // ユーザーが存在しない場合は何も表示しない（リダイレクト処理中）
  if (!user) {
    return null;
  }

  return <>{children}</>;
};
