import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface TokenHealthStatus {
  personaId: string;
  personaName: string;
  isHealthy: boolean;
  lastChecked: Date | null;
  error?: string;
}

export const useTokenHealth = () => {
  const { user } = useAuth();
  const [tokenStatuses, setTokenStatuses] = useState<TokenHealthStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const checkAllTokens = async (): Promise<TokenHealthStatus[] | undefined> => {
    if (!user?.id) {
      console.log('👤 No user available for token health check');
      return [];
    }

    console.log('🔄 Starting server-side token health check for all personas, user:', user.id);
    setLoading(true);
    try {
      // check-token-health Edge Functionを呼び出し
      const { data: response, error } = await supabase.functions.invoke('check-token-health', {
        body: {}
      });

      if (error) {
        console.error('❌ Edge Function呼び出しエラー:', error);
        // 認証エラーの場合は空の配列を設定
        setTokenStatuses([]);
        return [];
      }

      if (!response?.success) {
        console.error('❌ トークンヘルスチェックエラー:', response?.error);
        setTokenStatuses([]);
        return [];
      }

      const statuses: TokenHealthStatus[] = response.data.map((item: any) => ({
        personaId: item.personaId,
        personaName: item.personaName,
        isHealthy: item.isHealthy,
        lastChecked: new Date(item.lastChecked),
        error: item.error
      }));

      setTokenStatuses(statuses);
      console.log(`✅ Server-side token health check completed. Results:`, statuses.map(s => ({ name: s.personaName, healthy: s.isHealthy })));
      return statuses;
    } catch (error) {
      console.error('❌ Error checking token health:', error);
      // 認証エラーの場合は空の配列を設定
      setTokenStatuses([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const refreshTokenForPersona = async (personaId: string) => {
    // この関数は呼び出し元でペルソナ編集画面に遷移させる
    // 実際のトークン更新はペルソナ設定で行う
    return personaId;
  };

  useEffect(() => {
    console.log('🔄 useTokenHealth useEffect triggered, user:', user?.id);
    if (user?.id) {
      checkAllTokens();
    }
  }, [user?.id]);

  return {
    tokenStatuses,
    loading,
    checkAllTokens,
    refreshTokenForPersona
  };
};