
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAccountStatus } from "@/hooks/useAccountStatus";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isActive, isApproved, loading: accountLoading } = useAccountStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && !accountLoading && user) {
      const isHome = location.pathname === "/";
      if (!isHome && (!isActive || !isApproved)) {
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, accountLoading, isActive, isApproved, location.pathname, navigate]);

  // 認証中のみローディング表示
  if (loading || accountLoading) {
    return <LoadingSpinner message="認証確認中..." />;
  }

  if (user && location.pathname !== "/" && (!isActive || !isApproved)) {
    return null;
  }

  // ユーザーが存在しない場合は何も表示しない（リダイレクト処理中）
  if (!user) {
    return null;
  }

  return <>{children}</>;
};
