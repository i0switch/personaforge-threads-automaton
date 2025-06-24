
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAccountStatus } from "@/hooks/useAccountStatus";

export const AccountStatusBanner = () => {
  const { isApproved, isActive, loading } = useAccountStatus();

  if (loading) return null;

  if (!isApproved) {
    return (
      <Alert className="mb-6 border-orange-200 bg-orange-50">
        <Clock className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          アカウントは管理者の承認待ちです。承認されるまでアプリの機能を使用することはできません。
        </AlertDescription>
      </Alert>
    );
  }

  if (!isActive) {
    return (
      <Alert className="mb-6 border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          アカウントが無効化されています。管理者にお問い合わせください。
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
