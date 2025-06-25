
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
      setIsApproved(false);
      setIsActive(false);
      setLoading(false);
      return;
    }

    let mounted = true;

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

        if (mounted) {
          if (data) {
            setIsApproved(data.is_approved);
            setIsActive(data.is_active);
            console.log('Account status updated:', { 
              isApproved: data.is_approved, 
              isActive: data.is_active 
            });
          } else {
            console.log('No account status record found, user is not approved');
            setIsApproved(false);
            setIsActive(false);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        if (mounted) {
          setIsApproved(false);
          setIsActive(false);
          setLoading(false);
        }
      }
    };

    // 初回データ取得
    checkAccountStatus();

    // リアルタイム更新のサブスクリプション設定
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
          console.log('Real-time account status update:', payload);
          if (mounted && payload.new) {
            const newData = payload.new as { is_approved: boolean; is_active: boolean };
            setIsApproved(newData.is_approved);
            setIsActive(newData.is_active);
            console.log('Account status updated via real-time:', newData);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { isApproved, isActive, loading };
};
