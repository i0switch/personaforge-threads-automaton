
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from '@supabase/supabase-js';

export const useAccountStatus = () => {
  const { user } = useAuth();
  const [isApproved, setIsApproved] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // チャンネル管理を単一のrefで行う
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    
    // 初期化済みの場合は何もしない
    if (initializedRef.current) {
      return;
    }
    
    if (!user) {
      if (mountedRef.current) {
        setIsApproved(false);
        setIsActive(false);
        setLoading(false);
      }
      return;
    }

    const initializeAccountStatus = async () => {
      try {
        console.log('Initializing account status for user:', user.id);
        
        // 既存チャンネルのクリーンアップ
        if (channelRef.current) {
          console.log('Cleaning up existing channel');
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        // 初期データ取得
        const { data, error } = await supabase
          .from('user_account_status')
          .select('is_approved, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking account status:', error);
          return;
        }

        if (mountedRef.current) {
          if (data) {
            setIsApproved(data.is_approved);
            setIsActive(data.is_active);
            console.log('Account status loaded:', { 
              isApproved: data.is_approved, 
              isActive: data.is_active 
            });
          } else {
            setIsApproved(false);
            setIsActive(false);
          }
          setLoading(false);
        }

        // 新しいチャンネルを作成（ユーザーIDとタイムスタンプで一意化）
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
        initializedRef.current = true;

      } catch (error) {
        console.error('Error initializing account status:', error);
        if (mountedRef.current) {
          setIsApproved(false);
          setIsActive(false);
          setLoading(false);
        }
      }
    };

    initializeAccountStatus();

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        console.log('Cleaning up account status subscription');
        supabase.removeChannel(channelRef.current).then(() => {
          channelRef.current = null;
        });
      }
    };
  }, [user?.id]); // user.idが変わった時のみ実行

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      initializedRef.current = false;
    };
  }, []);

  return { isApproved, isActive, loading };
};
