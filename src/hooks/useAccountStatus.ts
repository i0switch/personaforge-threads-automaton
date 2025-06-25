
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
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
            console.log('Account status updated:', { isApproved: data.is_approved, isActive: data.is_active });
          } else {
            console.log('No account status record found, user is not approved');
            setIsApproved(false);
            setIsActive(false);
          }
        }
      } catch (error) {
        console.error('Error checking account status:', error);
        if (mounted) {
          setIsApproved(false);
          setIsActive(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Clean up existing channel before creating a new one
    if (channelRef.current) {
      console.log('Cleaning up existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    checkAccountStatus();

    // Create a unique channel name to avoid conflicts
    const channelName = `account-status-${user.id}-${Date.now()}`;
    console.log('Creating channel:', channelName);
    
    // リアルタイム更新を監視
    const channel = supabase
      .channel(channelName)
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
      });

    // Store the channel reference
    channelRef.current = channel;

    return () => {
      console.log('Cleaning up useAccountStatus effect');
      mounted = false;
      // Properly unsubscribe from the channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]); // Only depend on user.id to avoid unnecessary re-subscriptions

  return { isApproved, isActive, loading };
};
