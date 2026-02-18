import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting webhook reply check...');
    
    // パフォーマンス最適化：バッチ処理でアクティブなペルソナとその設定を取得
    // JOINを使わずに個別クエリ（重複FK回避）
    const { data: checkSettings, error } = await supabase
      .from('reply_check_settings')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch reply check settings:', error);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // ペルソナ情報を個別に取得してフィルタリング
    const activeSettings = [];
    for (const setting of (checkSettings || [])) {
      if (!setting.persona_id) continue;
      const { data: persona } = await supabase
        .from('personas')
        .select('id, name, user_id, threads_username, ai_auto_reply_enabled, auto_reply_enabled, is_active')
        .eq('id', setting.persona_id)
        .eq('is_active', true)
        .maybeSingle();
      if (persona) {
        activeSettings.push({ ...setting, personas: persona });
      }
    }

    if (!activeSettings || activeSettings.length === 0) {
      console.log('No active reply check settings found');
      return new Response(JSON.stringify({ 
        message: 'No active settings found',
        checked_personas: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log(`Found ${activeSettings.length} active reply check settings`);
    let totalRepliesFound = 0;
    let checkedPersonas = 0;

    // 並列処理で複数のペルソナを同時にチェック
    const checkPromises = activeSettings.map(async (setting) => {
      const persona = setting.personas;
      
      try {
        console.log(`Checking replies for persona: ${(persona as any).name} (${(persona as any).id})`);
        
        // アクセストークンを個別に取得（復号化のため）
        const { data: personaWithToken } = await supabase
          .from('personas')
          .select('threads_access_token')
          .eq('id', (persona as any).id)
          .maybeSingle();

        if (!personaWithToken?.threads_access_token) {
          console.log(`Skipping persona ${(persona as any).id} - no access token`);
          return 0;
        }

        // retrieve-secret関数を使用してアクセストークンを復号化（他の関数と同じ方式）
        let decryptedToken: string | null = null;
        try {
          const tokenResult = await supabase.functions.invoke('retrieve-secret', {
            body: {
              key: `threads_access_token_${(persona as any).id}`,
              fallback: personaWithToken.threads_access_token
            }
          });
          
          if (tokenResult.data?.secret) {
            decryptedToken = tokenResult.data.secret;
            console.log(`✅ 暗号化トークン復号化成功 - persona: ${(persona as any).name}`);
          } else if (personaWithToken.threads_access_token.startsWith('THAA')) {
            decryptedToken = personaWithToken.threads_access_token;
            console.log(`✅ 非暗号化トークン使用 - persona: ${(persona as any).name}`);
          }
        } catch (tokenError) {
          console.error(`Token retrieval error for persona ${(persona as any).id}:`, tokenError);
          if (personaWithToken.threads_access_token.startsWith('THAA')) {
            decryptedToken = personaWithToken.threads_access_token;
          }
        }

        if (!decryptedToken) {
          console.log(`Skipping persona ${(persona as any).id} - token decryption failed`);
          return 0;
        }

        // ペルソナ単位でリプライをチェック（check-repliesと同じアプローチ）
        const repliesFound = await checkRepliesForPersona(persona, decryptedToken);

        // last_check_atを更新
        await supabase
          .from('reply_check_settings')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', setting.id);

        checkedPersonas++;
        return repliesFound;

      } catch (error) {
        console.error(`Error processing persona ${(persona as any).id}:`, error);
        return 0;
      }
    });

    // 全ての並列処理の完了を待つ
    const results = await Promise.all(checkPromises);
    totalRepliesFound = results.reduce((sum, count) => sum + count, 0);

    console.log(`Reply check completed. Checked ${checkedPersonas} personas, found ${totalRepliesFound} new replies.`);

    return new Response(JSON.stringify({ 
      success: true,
      checked_personas: checkedPersonas,
      new_replies_found: totalRepliesFound,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Webhook reply check error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error) 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// check-repliesと同じアプローチ：ペルソナの全スレッドを取得してリプライを検出
async function checkRepliesForPersona(persona: any, accessToken: string): Promise<number> {
  try {
    console.log(`🔍 ペルソナ ${persona.name} のスレッドを取得中...`);
    
    // Threads APIからペルソナの全スレッドを取得（リプライを含む）
    const response = await fetch(
      `https://graph.threads.net/v1.0/me/threads?fields=id,text,username,timestamp,reply_to_id`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch threads for persona ${persona.id}: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return 0;
    }

    let newRepliesCount = 0;

    for (const thread of data.data) {
      // リプライでないものをスキップ
      if (!thread.reply_to_id) continue;

      // 自分自身のリプライをスキップ
      if (thread.username === persona.threads_username || thread.username === persona.name) {
        continue;
      }

      // 既存のリプライかチェック
      const { data: existingReply } = await supabase
        .from('thread_replies')
        .select('id')
        .eq('reply_id', thread.id)
        .maybeSingle();

      if (existingReply) {
        continue; // 既に保存済み
      }

      // 新しいリプライを保存
      const { error: insertError } = await supabase
        .from('thread_replies')
        .insert({
          user_id: persona.user_id,
          persona_id: persona.id,
          original_post_id: thread.reply_to_id,
          reply_id: thread.id,
          reply_text: thread.text || '',
          reply_author_id: thread.username || '',
          reply_author_username: thread.username,
          reply_timestamp: new Date(thread.timestamp || Date.now()).toISOString(),
          auto_reply_sent: false,
          reply_status: 'pending'
        });

      if (insertError) {
        console.error('Failed to save reply:', insertError);
        continue;
      }

      console.log(`Saved new reply: ${thread.id} from ${thread.username}`);
      newRepliesCount++;

      // AI自動返信が有効な場合のみ（キーワード返信のみONの場合はAIを呼ばない）
      if (persona.ai_auto_reply_enabled) {
        try {
          console.log(`Triggering auto-reply for persona ${persona.id}`);
          
          const autoReplyResponse = await supabase.functions.invoke('threads-auto-reply', {
            body: {
              postContent: '',
              replyContent: thread.text,
              replyId: thread.id,
              personaId: persona.id,
              userId: persona.user_id
            }
          });

          if (autoReplyResponse.error) {
            console.error('Auto-reply failed:', autoReplyResponse.error);
          } else {
            console.log('Auto-reply triggered successfully');
          }
        } catch (autoReplyError) {
          console.error('Error triggering auto-reply:', autoReplyError);
        }
      }
    }

    return newRepliesCount;

  } catch (error) {
    console.error(`Error checking replies for persona ${persona.id}:`, error);
    return 0;
  }
}