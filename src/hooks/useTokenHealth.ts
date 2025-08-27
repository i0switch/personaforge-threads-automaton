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

  const checkTokenHealth = async (personaId: string, accessToken: string): Promise<boolean> => {
    try {
      console.log(`🔍 Checking token health for persona ${personaId}`);
      
      // Threads APIで簡単なリクエストを送信してトークンの有効性を確認
      const response = await fetch('https://graph.threads.net/v1.0/me?fields=id', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log(`📊 Token health check result for ${personaId}: ${response.status} ${response.ok ? 'OK' : 'Failed'}`);
      
      // 403エラーの場合は認証ハンドラーに通知（ただし、fetchインターセプターで自動処理される）
      if (response.status === 403) {
        console.log(`🚫 403 error detected for persona ${personaId} - auth handler will process this`);
      }

      return response.ok;
    } catch (error) {
      console.error(`❌ Token health check failed for persona ${personaId}:`, error);
      return false;
    }
  };

  const checkAllTokens = async () => {
    if (!user?.id) {
      console.log('👤 No user available for token health check');
      return;
    }

    console.log('🔄 Starting token health check for all personas');
    setLoading(true);
    try {
      // アクティブなペルソナでThreadsアクセストークンを持つものを取得
      const { data: personas, error } = await supabase
        .from('personas')
        .select('id, name, threads_access_token')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .not('threads_access_token', 'is', null);

      if (error) {
        console.error('❌ Error fetching personas for token health check:', error);
        // 403エラーの場合は認証ハンドラーが処理するので、ここでは静かに失敗
        if (error.message?.includes('invalid claim') || error.message?.includes('bad_jwt')) {
          console.log('🔐 Authentication error detected in token health check');
          setTokenStatuses([]);
          return;
        }
        return;
      }

      console.log(`📋 Found ${personas?.length || 0} active personas with tokens`);

      const statuses: TokenHealthStatus[] = [];

      for (const persona of personas || []) {
        if (!persona.threads_access_token) {
          statuses.push({
            personaId: persona.id,
            personaName: persona.name,
            isHealthy: false,
            lastChecked: new Date(),
            error: 'アクセストークンが設定されていません'
          });
          continue;
        }

        try {
          // retrieve-secret Edge Functionを使用してトークンを取得
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('retrieve-secret', {
            body: { 
              key: `threads_access_token_${persona.id}`,
              fallback: persona.threads_access_token
            }
          });

          let accessToken = '';
          if (tokenData?.secret && !tokenError) {
            accessToken = tokenData.secret;
          } else if (persona.threads_access_token?.startsWith('THAA')) {
            accessToken = persona.threads_access_token;
          } else {
            statuses.push({
              personaId: persona.id,
              personaName: persona.name,
              isHealthy: false,
              lastChecked: new Date(),
              error: 'トークンの復号化に失敗しました'
            });
            continue;
          }

          const isHealthy = await checkTokenHealth(persona.id, accessToken);
          
          statuses.push({
            personaId: persona.id,
            personaName: persona.name,
            isHealthy,
            lastChecked: new Date(),
            error: isHealthy ? undefined : 'APIアクセスに失敗しました（無効なトークンまたは期限切れ）'
          });

        } catch (error) {
          statuses.push({
            personaId: persona.id,
            personaName: persona.name,
            isHealthy: false,
            lastChecked: new Date(),
            error: `チェック中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      setTokenStatuses(statuses);
      console.log(`✅ Token health check completed. Results:`, statuses.map(s => ({ name: s.personaName, healthy: s.isHealthy })));
    } catch (error) {
      console.error('❌ Error checking token health:', error);
      // 認証エラーの場合は空の配列を設定
      setTokenStatuses([]);
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