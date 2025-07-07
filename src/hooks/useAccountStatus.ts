
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AccountStatus {
  is_active: boolean;
  is_approved: boolean;
  subscription_status: string;
  approved_at?: string;
}

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // 最新のレコードを取得（重複がある場合に備えて）
        const { data, error: fetchError } = await supabase
          .from('user_account_status')
          .select('is_active, is_approved, subscription_status, approved_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching account status:', fetchError);
          setError('アカウント状態の取得に失敗しました');
          return;
        }

        if (!data) {
          console.log('No account status found for user:', user.id);
          // デフォルト値を設定
          setAccountStatus({
            is_active: false,
            is_approved: false,
            subscription_status: 'free'
          });
          return;
        }

        console.log('Account status loaded:', data);
        setAccountStatus(data);

      } catch (err) {
        console.error('Unexpected error:', err);
        setError('予期しないエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountStatus();
  }, [user?.id]);

  return {
    accountStatus,
    loading,
    error,
    isActive: accountStatus?.is_active || false,
    isApproved: accountStatus?.is_approved || false,
    subscriptionStatus: accountStatus?.subscription_status || 'free'
  };
};
