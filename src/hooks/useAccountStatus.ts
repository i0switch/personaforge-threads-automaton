
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setIsApproved(false);
      setIsActive(false);
      setLoading(false);
      return;
    }

    // 既存のチャンネルをクリーンアップ
    if (channelRef.current) {
      console.log('Cleaning up existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
            console.log('Account status updated:', { isApproved: data.is_approved, isActive: data.is_active });
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

    const setupRealtimeSubscription = () => {
      if (!mounted || !user) return;

      // 一意なチャンネル名を生成
      const channelName = `account-status-${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Creating unique channel:', channelName);
      
      // リアルタイム更新を監視
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
            presence: { key: user.id }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_account_status',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Real-time account status change:', payload);
            if (mounted && payload.new && typeof payload.new === 'object') {
              const newData = payload.new as { is_approved: boolean; is_active: boolean };
              console.log('Updating status from realtime:', newData);
              setIsApproved(newData.is_approved);
              setIsActive(newData.is_active);
            }
          }
        )
        .subscribe((status) => {
          console.log('Channel subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to realtime updates');
          }
        });

      channelRef.current = channel;
    };

    // 初期化が完了していない場合のみ実行
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      checkAccountStatus().then(() => {
        if (mounted) {
          setupRealtimeSubscription();
        }
      });
    }

    return () => {
      console.log('Cleaning up useAccountStatus effect');
      mounted = false;
      if (channelRef.current) {
        console.log('Removing channel subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]); // user.idのみに依存

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('Component unmounting, cleaning up channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  return { isApproved, isActive, loading };
};
