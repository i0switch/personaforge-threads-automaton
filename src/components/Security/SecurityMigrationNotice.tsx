import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityMigrationNoticeProps {
  userId: string;
}

export const SecurityMigrationNotice = ({ userId }: SecurityMigrationNoticeProps) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkIfShouldShowNotice();
  }, [userId]);

  const checkIfShouldShowNotice = async () => {
    try {
      // アカウント状態を確認
      const { data: accountStatus, error: statusError } = await supabase
        .from('user_account_status')
        .select('security_migration_notified')
        .eq('user_id', userId)
        .single();

      if (statusError || !accountStatus) {
        setIsLoading(false);
        return;
      }

        // まだ通知されていない場合
        if (!accountStatus.security_migration_notified) {
          // APIキーがあるかチェック（セキュリティ向上のため全ユーザーに通知）
          const { data: apiKeys, error: keysError } = await supabase
            .from('user_api_keys')
            .select('encrypted_key')
            .eq('user_id', userId);

          if (keysError) {
            setIsLoading(false);
            return;
          }

          // APIキーが存在する場合は通知を表示（セキュリティ向上のため）
          if (apiKeys && apiKeys.length > 0) {
            setShouldShow(true);
          }
        }
    } catch (error) {
      console.error('セキュリティ通知チェックエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsNotified = async () => {
    try {
      const { error } = await supabase
        .from('user_account_status')
        .update({ security_migration_notified: true })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      setShouldShow(false);
      
      toast({
        title: "通知を非表示にしました",
        description: "セキュリティ設定ページでAPIキーを再設定してください。",
      });
    } catch (error) {
      console.error('通知マーク更新エラー:', error);
      toast({
        title: "エラー",
        description: "通知の更新に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const goToSettings = () => {
    markAsNotified();
    // 設定ページに移動
    window.location.href = '/settings';
  };

  if (isLoading || !shouldShow) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              セキュリティ向上のお知らせ
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 mt-2">
              ペルソナ設定のアクセストークンを再度設定し直してください。
            </AlertDescription>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={goToSettings}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                設定ページへ
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={markAsNotified}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              >
                後で設定
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={markAsNotified}
            className="p-1 h-6 w-6 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
};