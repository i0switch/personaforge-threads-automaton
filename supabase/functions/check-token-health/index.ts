import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TokenHealthRequest {
  personaIds?: string[];
}

interface TokenHealthStatus {
  personaId: string;
  personaName: string;
  isHealthy: boolean;
  lastChecked: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ユーザー認証
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('認証が必要です');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('認証に失敗しました');
    }

    console.log('🔄 トークンヘルスチェック開始 - user:', user.id);

    const { personaIds }: TokenHealthRequest = await req.json();

    // ユーザーのアクティブなペルソナを取得
    let query = supabaseClient
      .from('personas')
      .select('id, name, threads_access_token')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('threads_access_token', 'is', null);

    if (personaIds && personaIds.length > 0) {
      query = query.in('id', personaIds);
    }

    const { data: personas, error } = await query;

    if (error) {
      console.error('❌ ペルソナ取得エラー:', error);
      throw new Error('ペルソナの取得に失敗しました');
    }

    console.log(`📋 ${personas?.length || 0}個のペルソナをチェック`);

    const results: TokenHealthStatus[] = [];

    for (const persona of personas || []) {
      console.log(`🔍 ペルソナ ${persona.name} (${persona.id}) のトークンチェック開始`);

      if (!persona.threads_access_token) {
        results.push({
          personaId: persona.id,
          personaName: persona.name,
          isHealthy: false,
          lastChecked: new Date().toISOString(),
          error: 'アクセストークンが設定されていません'
        });
        continue;
      }

      try {
        // retrieve-secret Edge Functionを使用してトークンを取得
        const { data: tokenData, error: tokenError } = await supabaseClient.functions.invoke('retrieve-secret', {
          body: { 
            key: `threads_access_token_${persona.id}`,
            fallback: persona.threads_access_token
          }
        });

        let accessToken = '';
        if (tokenData?.secret && !tokenError) {
          accessToken = tokenData.secret;
          console.log(`✅ トークン取得成功: ${persona.name} (${tokenData.source})`);
        } else if (persona.threads_access_token?.startsWith('THAA')) {
          accessToken = persona.threads_access_token;
          console.log(`✅ フォールバックトークン使用: ${persona.name}`);
        } else {
          console.log(`❌ トークン取得失敗: ${persona.name}`, tokenError);
          results.push({
            personaId: persona.id,
            personaName: persona.name,
            isHealthy: false,
            lastChecked: new Date().toISOString(),
            error: 'トークンの復号化に失敗しました'
          });
          continue;
        }

        if (!accessToken || accessToken.length < 10) {
          results.push({
            personaId: persona.id,
            personaName: persona.name,
            isHealthy: false,
            lastChecked: new Date().toISOString(),
            error: '無効なトークン形式です'
          });
          continue;
        }

        // Threads APIでトークンの有効性を確認
        console.log(`🌐 Threads API チェック: ${persona.name}`);
        const response = await fetch('https://graph.threads.net/v1.0/me?fields=id', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const isHealthy = response.ok;
        console.log(`📊 ${persona.name} トークンヘルス: ${isHealthy ? '✅ 正常' : '❌ 異常'} (${response.status})`);

        let errorMessage: string | undefined;
        if (!isHealthy) {
          try {
            const errorData = await response.text();
            if (response.status === 403) {
              errorMessage = 'アクセス権限がありません（トークンが無効または期限切れ）';
            } else if (response.status === 401) {
              errorMessage = '認証に失敗しました（トークンが無効）';
            } else {
              errorMessage = `APIアクセスエラー (${response.status})`;
            }
          } catch {
            errorMessage = `APIアクセスに失敗しました (${response.status})`;
          }
        }

        results.push({
          personaId: persona.id,
          personaName: persona.name,
          isHealthy,
          lastChecked: new Date().toISOString(),
          error: errorMessage
        });

      } catch (error) {
        console.error(`❌ ${persona.name} チェック中にエラー:`, error);
        results.push({
          personaId: persona.id,
          personaName: persona.name,
          isHealthy: false,
          lastChecked: new Date().toISOString(),
          error: `チェック中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    console.log(`✅ トークンヘルスチェック完了 - ${results.length}件処理`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: results 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ トークンヘルスチェックエラー:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'トークンヘルスチェックに失敗しました' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});