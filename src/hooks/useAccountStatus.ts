
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // チャンネルインスタンスを保持して重複購読を防ぐ
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!user) {
      if (mountedRef.current) {
        setIsApproved(false);
        setIsActive(false);
        setLoading(false);
      }
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

        if (mountedRef.current) {
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
        if (mountedRef.current) {
          setIsApproved(false);
          setIsActive(false);
          setLoading(false);
        }
      }
    };

    // 初回データ取得
    checkAccountStatus();

    // 既存のチャンネルがあれば削除
    if (channelRef.current) {
      console.log('Removing existing channel before creating new one');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // リアルタイム更新のサブスクリプション設定（一意な名前で重複を防ぐ）
    const channelName = `account-status-${user.id}-${Date.now()}`;
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
          console.log('Real-time account status update:', payload);
          if (mountedRef.current && payload.new) {
            const newData = payload.new as { is_approved: boolean; is_active: boolean };
            setIsApproved(newData.is_approved);
            setIsActive(newData.is_active);
            console.log('Account status updated via real-time:', newData);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Channel subscription error:', err);
        } else {
          console.log('Channel subscription status:', status);
        }
      });

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        console.log('Cleaning up account status subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { isApproved, isActive, loading };
};
