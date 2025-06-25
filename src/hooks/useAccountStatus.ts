
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkAccountStatus = async () => {
      try {
        console.log('Checking account status for user:', user.id);
        
        const { data, error } = await supabase
          .from('user_account_status')
          .select('is_approved, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking account status:', error);
          return;
        }

        console.log('Account status data:', data);

        if (data) {
          setIsApproved(data.is_approved);
          setIsActive(data.is_active);
        } else {
          // アカウント状態レコードが存在しない場合は未承認とする
          console.log('No account status record found, user is not approved');
          setIsApproved(false);
          setIsActive(false);
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        setIsApproved(false);
        setIsActive(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccountStatus();

    // リアルタイム更新を監視
    const channel = supabase
      .channel('account-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_account_status',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Account status changed:', payload);
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as { is_approved: boolean; is_active: boolean };
            setIsApproved(newData.is_approved);
            setIsActive(newData.is_active);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { isApproved, isActive, loading };
};
