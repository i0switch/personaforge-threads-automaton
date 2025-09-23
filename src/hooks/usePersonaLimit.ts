
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isWebSocketRestricted } from '@/utils/platform';

interface PersonaLimitInfo {
  currentCount: number;
  personaLimit: number;
  canCreate: boolean;
}

export const usePersonaLimit = () => {
  const { user } = useAuth();
  const [limitInfo, setLimitInfo] = useState<PersonaLimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkPersonaLimit = async () => {
    if (!user?.id) {
      console.debug('[usePersonaLimit] early return (no user/session)');
      setLimitInfo({
        currentCount: 0,
        personaLimit: 1,
        canCreate: true
      });
      setLoading(false);
      return;
    }

    try {
      console.log(`[usePersonaLimit] Checking persona limit for user: ${user.id}`);
      
      // 最新のペルソナ数を取得
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('id')
        .eq('user_id', user.id);

      if (personasError) {
        console.error('Error fetching personas:', personasError);
        // 認証関連のエラーの場合は静かに失敗させる
        if (personasError.message.includes('invalid claim') || personasError.message.includes('bad_jwt')) {
          console.log('Authentication error in usePersonaLimit, using default values');
          setLimitInfo({
            currentCount: 0,
            personaLimit: 1,
            canCreate: true
          });
          setLoading(false);
          return;
        }
        throw personasError;
      }

      const actualPersonaCount = personasData?.length || 0;
      console.log(`Direct persona count: ${actualPersonaCount}`);

      // 最新のアカウント状態を取得
      const { data: accountData, error: accountError } = await supabase
        .from('user_account_status')
        .select('persona_limit')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      let personaLimit = 1; // デフォルト値

      if (accountError) {
        console.error('Error fetching account status:', accountError);
        // エラーの場合はデフォルト値を使用
      } else if (accountData) {
        personaLimit = accountData.persona_limit || 1;
        console.log('Account data:', accountData);
      } else {
        console.log('No account status found, using default limit');
      }

      const canCreate = actualPersonaCount < personaLimit;
      
      console.log(`User ${user.id}: ${actualPersonaCount}/${personaLimit} personas, can create: ${canCreate}`);
      
      const newLimitInfo = {
        currentCount: actualPersonaCount,
        personaLimit,
        canCreate
      };

      setLimitInfo(newLimitInfo);
      console.log('Updated limit info:', newLimitInfo);

    } catch (err) {
      console.error('Unexpected error in usePersonaLimit:', err);
      // エラーが発生してもデフォルト値でフォールバック
      setLimitInfo({
        currentCount: 0,
        personaLimit: 1,
        canCreate: true
      });
      setError(null); // エラーメッセージは表示せず、デフォルト値で動作を継続
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // userが存在する場合のみ処理を実行
    if (!user) {
      setLoading(false);
      setLimitInfo(null);
      setError(null);
      return;
    }

    checkPersonaLimit();

    // Safari/WebKit環境ではRealtimeを無効化しポーリングにフォールバック
    const isRestricted = isWebSocketRestricted();

    let accountChannel: any = null;
    let personasChannel: any = null;
    let pollTimer: number | null = null;

    if (isRestricted) {
      console.warn('Safari/WebKit 環境のため、Realtime を無効化しポーリングにフォールバックします');
      pollTimer = window.setInterval(checkPersonaLimit, 10000);
    } else {
      try {
        const channelId = Math.random().toString(36).slice(2, 10);
        // user_account_statusテーブルの変更をリアルタイムで監視
        accountChannel = supabase
          .channel(`user_account_status_changes_${user.id}_${channelId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_account_status',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Account status updated:', payload);
              checkPersonaLimit();
            }
          )
          .subscribe();

        // personasテーブルの変更も監視
        personasChannel = supabase
          .channel(`personas_changes_${user.id}_${channelId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'personas',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Personas updated:', payload);
              // ペルソナの変更時は少し遅延を入れてからチェック
              setTimeout(checkPersonaLimit, 500);
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime 購読の初期化に失敗。ポーリングにフォールバックします:', e);
        pollTimer = window.setInterval(checkPersonaLimit, 10000);
      }
    }

    return () => {
      console.log('🧹 Cleaning up usePersonaLimit subscriptions');
      try {
        if (accountChannel) supabase.removeChannel(accountChannel);
        if (personasChannel) supabase.removeChannel(personasChannel);
      } catch (e) {
        console.warn('Realtime チャネルのクリーンアップに失敗:', e);
      }
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [user]);

  return {
    limitInfo,
    loading,
    error,
    refetch: checkPersonaLimit
  };
};
