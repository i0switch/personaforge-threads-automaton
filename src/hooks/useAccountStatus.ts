
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AccountStatus {
  isApproved: boolean;
  isActive: boolean;
  subscriptionStatus: string;
  loading: boolean;
}

export const useAccountStatus = (): AccountStatus => {
  const { user } = useAuth();
  const [accountStatus, setAccountStatus] = useState<AccountStatus>({
    isApproved: false,
    isActive: false,
    subscriptionStatus: 'free',
    loading: true
  });

  useEffect(() => {
    if (user) {
      checkAccountStatus();
    }
  }, [user]);

  const checkAccountStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_account_status')
        .select('is_approved, is_active, subscription_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking account status:', error);
        setAccountStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      if (data) {
        setAccountStatus({
          isApproved: data.is_approved,
          isActive: data.is_active,
          subscriptionStatus: data.subscription_status || 'free',
          loading: false
        });
      } else {
        // アカウント状態が存在しない場合、デフォルト値を設定
        console.log('No account status found for user, using defaults');
        setAccountStatus({
          isApproved: false,
          isActive: false,
          subscriptionStatus: 'free',
          loading: false
        });
      }
    } catch (error) {
      console.error('Error checking account status:', error);
      setAccountStatus(prev => ({ ...prev, loading: false }));
    }
  };

  return accountStatus;
};
