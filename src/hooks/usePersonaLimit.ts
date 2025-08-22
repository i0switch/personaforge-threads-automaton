
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log(`Checking persona limit for user: ${user.id}`);
      
      // 最新のペルソナ数を取得
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('id')
        .eq('user_id', user.id);

      if (personasError) {
        console.error('Error fetching personas:', personasError);
        throw personasError;
      }

      const actualPersonaCount = personasData?.length || 0;
      console.log(`Direct persona count: ${actualPersonaCount}`);

      // 最新のアカウント状態を取得（重複を避けるため DISTINCT ON を使用）
      const { data: accountData, error: accountError } = await supabase
        .from('user_account_status')
        .select('persona_limit')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      let personaLimit = 1; // デフォルト値

      if (accountError) {
        console.error('Error fetching account status:', accountError);
        // エラーの場合はデフォルト値を使用
      } else if (accountData && accountData.length > 0) {
        personaLimit = accountData[0].persona_limit || 1;
        console.log('Account data:', accountData[0]);
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

    // user_account_statusテーブルの変更をリアルタイムで監視
    const accountChannel = supabase
      .channel('user_account_status_changes')
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
    const personasChannel = supabase
      .channel('personas_changes')
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

    return () => {
      supabase.removeChannel(accountChannel);
      supabase.removeChannel(personasChannel);
    };
  }, [user]);

  return {
    limitInfo,
    loading,
    error,
    refetch: checkPersonaLimit
  };
};
