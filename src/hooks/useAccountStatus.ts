
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
    let channel: any = null;

    const fetchAccountStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('user_account_status')
          .select('is_active, is_approved, subscription_status, approved_at')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          console.error('Error fetching account status:', fetchError);
          setError('アカウント状態の取得に失敗しました');
          return;
        }

        setAccountStatus(data);

        // Realtimeチャンネルの設定（静的なチャンネル名を使用）
        channel = supabase
          .channel(`account-status-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_account_status',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Account status updated:', payload.new);
              setAccountStatus(payload.new as AccountStatus);
            }
          )
          .subscribe();

      } catch (err) {
        console.error('Unexpected error:', err);
        setError('予期しないエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountStatus();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  return {
    accountStatus,
    loading,
    error,
    isActive: accountStatus?.is_active || false,
    isApproved: accountStatus?.is_approved || false,
    subscriptionStatus: accountStatus?.subscription_status || 'free'
  };
};
