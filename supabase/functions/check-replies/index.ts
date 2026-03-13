
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { decryptIfNeeded, getUserApiKeyDecrypted } from '../_shared/crypto.ts';
import { normalizeEmojiAndText, isKeywordMatch } from '../_shared/keyword-matcher.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAX_PROCESS_COUNT = 100; // 最大処理数制限
const MAX_AUTO_REPLY_DEPTH = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting reply check...');
    const processedPersonas = new Set<string>();
    let processCount = 0;
    
    // 処理数制限チェック
    if (processCount >= MAX_PROCESS_COUNT) {
      console.log('⚠️ 処理数制限に達しました。無限ループ防止のため終了します。');
      return new Response(JSON.stringify({ 
        message: 'Process limit reached to prevent infinite loop',
        processCount 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

  // CRITICAL FIX: 重複外部キーの問題を回避するため、JOINを使わずに個別にクエリ
  const { data: checkSettings, error: settingsError } = await supabase
    .from('reply_check_settings')
    .select('*')
    .eq('is_active', true);
  
  console.log(`🔍 Fetched ${checkSettings?.length || 0} reply check settings from database`);
  
  if (settingsError) {
    console.error('❌ Settings fetch error:', settingsError);
    throw settingsError;
  }
  
  if (!checkSettings || checkSettings.length === 0) {
    console.log('No active reply check settings found');
    return new Response(JSON.stringify({ message: 'No active settings' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
  
  // ペルソナ情報を個別に取得してアクティブなもののみフィルタリング
  const activeSettings = [];
  for (const setting of checkSettings) {
      const { data: persona } = await supabase
        .from('personas')
        .select('id, name, user_id, threads_username, threads_user_id, ai_auto_reply_enabled, auto_reply_enabled, is_active')
        .eq('id', setting.persona_id)
        .eq('is_active', true)
        .maybeSingle();
    
    if (persona) {
      activeSettings.push({
        ...setting,
        personas: persona
      });
    } else {
      console.log(`⏭️ Skipping inactive or missing persona for setting: ${setting.id}`);
    }
  }

    console.log(`✅ Found ${activeSettings.length} active settings with active personas to process`);

    let totalRepliesFound = 0;

    // まずスケジュールされた返信を処理
    await processScheduledReplies();

    for (const setting of activeSettings) {
      const persona = setting.personas;
      if (!persona?.id) {
        console.log(`Skipping invalid persona`);
        continue;
      }

      // 無限ループ防止：重複処理チェック
      if (processedPersonas.has(persona.id)) {
        console.log(`⚠️ ペルソナ ${persona.id} は既に処理済みです。スキップします。`);
        continue;
      }
      
      // 処理数カウンタ増加
      processCount++;
      processedPersonas.add(persona.id);
      
      // 緊急停止：異常な処理数検出
      if (processCount > MAX_PROCESS_COUNT) {
        console.log('🚨 緊急停止：異常な処理数を検出しました');
        break;
      }

      // アクセストークンとトークン期限を取得（復号化のため）
      const { data: personaWithToken } = await supabase
        .from('personas')
        .select('threads_access_token, token_expires_at, is_rate_limited, rate_limit_until')
        .eq('id', persona.id)
        .maybeSingle();

      if (!personaWithToken?.threads_access_token) {
        console.log(`Skipping persona ${persona.id} - no access token`);
        continue;
      }

      // トークン期限切れの事前チェック（API呼び出し前にスキップ）
      if (personaWithToken.token_expires_at) {
        const expiresAt = new Date(personaWithToken.token_expires_at).getTime();
        if (expiresAt < Date.now()) {
          console.log(`⏭️ トークン期限切れスキップ: ${persona.name} (期限: ${personaWithToken.token_expires_at})`);
          continue;
        }
      }

      // レート制限中のペルソナをスキップ
      if (personaWithToken.is_rate_limited) {
        const rateLimitUntil = personaWithToken.rate_limit_until ? new Date(personaWithToken.rate_limit_until).getTime() : 0;
        if (!rateLimitUntil || rateLimitUntil > Date.now()) {
          console.log(`⏭️ レート制限中スキップ: ${persona.name}`);
          continue;
        }
      }

      console.log(`🚀 リプライチェック開始 - persona: ${persona.name} (ID: ${persona.id})`);
      
      // アクセストークンを取得（直接復号 - retrieve-secret経由ではなくcryptoモジュール使用）
      let accessToken = null;
      try {
        // まずuser_api_keysから暗号化キーを取得して直接復号
        const decryptedFromDb = await getUserApiKeyDecrypted(
          supabase, persona.user_id, 'threads_access_token'
        );
        
        if (decryptedFromDb) {
          accessToken = decryptedFromDb;
          console.log(`✅ user_api_keysから復号成功 - persona: ${persona.name}`);
        } else {
          // user_api_keysになければpersonasテーブルのトークンを直接復号
          accessToken = await decryptIfNeeded(
            personaWithToken.threads_access_token,
            `check-replies:persona:${persona.id}`
          );
          if (accessToken) {
            console.log(`✅ personasテーブルから復号成功 - persona: ${persona.name}`);
          }
        }
        
        if (!accessToken) {
          console.error(`❌ アクセストークン取得失敗 - persona: ${persona.name}`);
          continue;
        }
      } catch (error) {
        console.error(`❌ アクセストークン処理エラー - persona: ${persona.name}:`, error);
        continue;
      }

      // ペルソナオブジェクトにアクセストークンを追加
      const personaWithDecryptedToken = {
        ...persona,
        threads_access_token: accessToken
      };

      try {
        console.log(`Checking replies for persona: ${personaWithDecryptedToken.name}`);

        // 最近投稿された投稿のIDを取得
        const { data: recentPosts } = await supabase
          .from('posts')
          .select('id, content, published_at')
          .eq('persona_id', personaWithDecryptedToken.id)
          .eq('status', 'published')
          .not('published_at', 'is', null)
          .order('published_at', { ascending: false })
          .limit(10);

        if (!recentPosts || recentPosts.length === 0) {
          console.log(`No recent posts found for persona ${personaWithDecryptedToken.id}`);
          continue;
        }

        // ペルソナの全スレッドを一度だけ取得してリプライをチェック
        // （各投稿ごとに同じ/me/threadsを呼ぶ無駄を排除）
        const repliesFound = await checkRepliesForPost(personaWithDecryptedToken, recentPosts[0].id);
        totalRepliesFound += repliesFound;

        // 最後のチェック時刻を更新
        await supabase
          .from('reply_check_settings')
          .update({ last_check_at: new Date().toISOString() })
          .eq('id', setting.id);

      } catch (error) {
        console.error(`Error checking replies for persona ${persona?.id}:`, error);
      }
    }

    console.log(`Reply check completed. Found ${totalRepliesFound} new replies.`);

    return new Response(JSON.stringify({ 
      success: true,
      repliesFound: totalRepliesFound,
      message: 'Reply check completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in reply check:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function checkRepliesForPost(persona: any, postId: string): Promise<number> {
  try {
    // Threads APIを使用してメンション・リプライを検索
    // Note: Threads APIの実際のエンドポイントは公式ドキュメントを確認してください
    console.log(`🔍 Fetching threads for persona ${persona.id}`);

    // threads_user_idが未設定の場合、自動取得を試みる
    if (!persona.threads_user_id) {
      console.warn(`⚠️ threads_user_id未設定: persona ${persona.name} (${persona.id}) - 自動取得を試行`);
      try {
        const profileRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username`, {
          headers: { 'Authorization': `Bearer ${persona.threads_access_token}` }
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.id) {
            const updateData: Record<string, string> = { threads_user_id: profile.id };
            if (profile.username) updateData.threads_username = profile.username;
            await supabase.from('personas').update(updateData).eq('id', persona.id);
            console.log(`✅ threads_user_id自動設定完了: ${persona.name} → ${profile.id}`);
          }
        } else {
          console.error(`❌ threads_user_id取得失敗: ${persona.name} - ${profileRes.status}`);
        }
      } catch (e) {
        console.error(`❌ threads_user_id取得エラー: ${persona.name}`, e);
      }
    }

    const response = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,username,timestamp,reply_to_id`, {
      headers: { 'Authorization': `Bearer ${persona.threads_access_token}` }
    });
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown');
      console.error(`Failed to fetch threads for persona ${persona.id}: ${response.status}`, errorBody);
      
      // 401(期限切れ) or 400(API無効化) の場合、ペルソナを自動的に非アクティブ化して無駄なリトライを防止
      if (response.status === 401 || response.status === 400) {
        const isExpired = response.status === 401;
        const isDeactivated = response.status === 400;
        
        const updateData: Record<string, unknown> = {};
        if (isExpired) {
          // トークン期限切れ: token_expires_atを過去に設定して次回からスキップ
          updateData.token_expires_at = new Date(Date.now() - 1000).toISOString();
          console.log(`🔒 トークン期限切れマーク: ${persona.name}`);
        }
        if (isDeactivated) {
          // API無効化: is_rate_limitedフラグで一時停止
          updateData.is_rate_limited = true;
          updateData.rate_limit_reason = 'API access deactivated';
          updateData.rate_limit_detected_at = new Date().toISOString();
          // 24時間後に再チェック
          updateData.rate_limit_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          console.log(`🔒 API無効化マーク: ${persona.name} (24時間スキップ)`);
        }
        
        if (Object.keys(updateData).length > 0) {
          await supabase.from('personas').update(updateData).eq('id', persona.id);
        }
      }
      
      // エラー詳細をsecurity_eventsに記録
      await supabase.from('security_events').insert({
        event_type: 'check_replies_api_error',
        user_id: persona.user_id,
        details: {
          persona_id: persona.id,
          persona_name: persona.name,
          status_code: response.status,
          error_body: errorBody,
          has_threads_user_id: !!persona.threads_user_id,
          timestamp: new Date().toISOString()
        }
      });
      return 0;
    }

    const data = await response.json();
    let newRepliesCount = 0;

    if (data.data) {
      for (const thread of data.data) {
        // リプライかどうかを判定
        if (thread.reply_to_id) {
          // 自分自身のリプライをスキップ（強化版フィルタ）
          const isSelf = 
            thread.username === persona.name ||
            thread.username === persona.threads_username ||
            thread.owner_id === persona.user_id ||
            thread.author_id === persona.user_id;
          
          if (isSelf) {
            console.log(`Skipping self-reply ${thread.id} from persona ${persona.name}`);
            continue;
          }

          const safety = await evaluateReplyRoutingSafety(persona, {
            id: thread.id,
            username: thread.username,
            replied_to: { id: thread.reply_to_id },
            root_post: { id: thread.reply_to_id }
          });

          if (safety.skip) {
            console.log(`⏭️ ループ防止によりスキップ: ${thread.id} (${safety.reason})`);
            continue;
          }

          // すでに保存されているかチェック
          const { data: existingReply } = await supabase
            .from('thread_replies')
            .select('id, auto_reply_sent, reply_status, updated_at, error_details')
            .eq('reply_id', thread.id)
            .maybeSingle();

           let shouldProcessAutoReply = false;

           if (!existingReply) {
             // 新しいリプライを保存
             console.log(`🆕 新しいリプライを保存中: ${thread.id} - "${thread.text}"`);
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
                 reply_status: 'pending',
                 error_details: {
                   ingest_source: 'polling',
                   reply_depth: safety.replyDepth,
                   loop_guard_version: '2026-03-03'
                 }
               });

             if (!insertError) {
               newRepliesCount++;
               shouldProcessAutoReply = true;
               console.log(`✅ 新しいリプライ保存完了: ${thread.id}`);
               
               // アクティビティログを記録
               await supabase
                 .from('activity_logs')
                 .insert({
                   user_id: persona.user_id,
                   persona_id: persona.id,
                   action_type: 'reply_received',
                   description: `新しいリプライを受信: @${thread.username}`,
                   metadata: {
                     author: thread.username,
                     reply_id: thread.id,
                     reply_text: thread.text
                   }
                 });
             } else {
               console.error(`❌ リプライ保存エラー: ${thread.id}`, insertError);
             }
           } else if (!existingReply.auto_reply_sent && existingReply.reply_status === 'pending') {
             // 既存のリプライで、まだ自動返信が送信されていない、かつpending状態のみ再処理
             // failed/sent/scheduled/completedは process-unhandled-replies 側で適切にリトライされるためスキップ
             const updatedAt = existingReply.updated_at ? new Date(existingReply.updated_at).getTime() : 0;
             const isStalePending = Date.now() - updatedAt > 2 * 60 * 1000;
             if (isStalePending) {
               shouldProcessAutoReply = true;
               console.log(`🔄 stale pending を再処理: ${thread.id}`);
             } else {
               console.log(`⏭️ pending 直後のため再処理保留: ${thread.id}`);
             }
           } else {
             console.log(`⏭️ Already handled reply (status=${existingReply.reply_status}, sent=${existingReply.auto_reply_sent}): ${thread.id}`);
           }

           // 自動返信の処理（キーワード自動返信 + AI自動返信）
           if (shouldProcessAutoReply) {
             console.log(`🤖 自動返信処理開始: ${thread.id} for persona ${persona.name}`);
             
             // 🔒 処理開始前にステータスのみ更新（楽観的ロック）
             // auto_reply_sent は各処理パスで個別に管理（threads-auto-replyとの競合を回避）
             const { data: lockResult, error: lockError } = await supabase
               .from('thread_replies')
               .update({ 
                 reply_status: 'processing',
                 updated_at: new Date().toISOString()
               })
               .eq('reply_id', thread.id)
               .eq('auto_reply_sent', false) // 既に処理済みでないことを確認
               .eq('reply_status', 'pending') // pendingのみをclaimし、scheduled/failedとの競合を回避
               .select('id');
             
             if (lockError || !lockResult || lockResult.length === 0) {
               console.log(`⏭️ リプライロック取得失敗（既に処理中の可能性）: ${thread.id}`);
               continue;
             }
             
             const replyObject = {
               id: thread.id,
               text: thread.text,
               username: thread.username,
               timestamp: thread.timestamp,
               replied_to: { id: thread.reply_to_id }
             };
             
              try {
                let replySent = false;
                
                // キーワード自動返信をチェック（auto_repliesテーブルのis_activeで判断）
                const templateResult = await processTemplateAutoReply(persona, replyObject);
                if (templateResult.sent) {
                  console.log(`✅ 定型文自動返信成功 - reply: ${thread.id}`);
                  replySent = true;
                }

                // AI自動返信をチェック（定型文が送信されなかった場合のみ、AI自動返信ONの場合のみ）
                // auto_reply_enabled=trueでもai_auto_reply_enabled=falseならAIフォールバックしない
                if (!replySent && persona.ai_auto_reply_enabled) {
                 const autoReplyResult = await supabase.functions.invoke('threads-auto-reply', {
                   body: {
                     postContent: 'Original post content',
                     replyContent: thread.text,
                     replyId: thread.id,
                     personaId: persona.id,
                     userId: persona.user_id
                   }
                 });

                if (autoReplyResult.error) {
                    console.error(`❌ AI自動返信呼び出しエラー:`, autoReplyResult.error);
                    // エラー時は処理失敗としてマーク + エラー詳細を必ず記録
                    await supabase
                      .from('thread_replies')
                      .update({ 
                        reply_status: 'failed',
                        auto_reply_sent: false,
                        error_details: {
                          error: 'AI Auto Reply Invocation Failed',
                          message: autoReplyResult.error.message || String(autoReplyResult.error),
                          error_code: autoReplyResult.error.code,
                          timestamp: new Date().toISOString(),
                          context: 'check-replies AI auto reply'
                        }
                      })
                      .eq('reply_id', thread.id);
                 } else {
                   console.log(`✅ AI自動返信呼び出し成功: ${thread.id}`);
                   replySent = true;
                 }
               }
               
               // 両方とも送信されなかった場合（設定無効・条件不一致）
               if (!replySent) {
                 console.log(`⚠️ 自動返信なし（設定無効または条件不一致） - reply: ${thread.id}`);
                 // ★ reply_statusをcompletedに設定（pendingに戻すとcheck-repliesで再トリガーされる）
                 // auto_reply_sentはfalseのまま（lockでprocessingにしただけ）なので
                 // 設定変更後にprocess-unhandled-repliesが再試行可能
                 await supabase
                   .from('thread_replies')
                   .update({ 
                     reply_status: 'completed',
                     auto_reply_sent: true  // ★ これ以上自動処理しない
                   })
                   .eq('reply_id', thread.id);
               }
             } catch (error) {
            console.error(`❌ 自動返信処理エラー:`, error);
                // エラー時はロックを解除 + エラー詳細を必ず記録
                await supabase
                  .from('thread_replies')
                  .update({ 
                    reply_status: 'failed',
                    auto_reply_sent: false,
                    error_details: {
                      error: 'Auto Reply Processing Error',
                      message: error instanceof Error ? error.message : String(error),
                      stack: error instanceof Error ? error.stack : undefined,
                      timestamp: new Date().toISOString(),
                      context: 'check-replies auto reply processing'
                    }
                  })
                  .eq('reply_id', thread.id);
             }
           }
         }
       }
     }

     return newRepliesCount;
   } catch (error) {
     console.error(`Error checking replies for post ${postId}:`, error);
     return 0;
   }
 }

async function evaluateReplyRoutingSafety(
  persona: any,
  reply: any
): Promise<{ skip: boolean; reason?: string; replyDepth: number }> {
  const author = String(reply.username || '').toLowerCase();
  const botUsernames = await getBotUsernamesForUser(persona.user_id);

  if (author && botUsernames.has(author)) {
    return { skip: true, reason: 'bot_author_detected', replyDepth: 0 };
  }

  const parentReplyId = reply.replied_to?.id || reply.root_post?.id;
  if (!parentReplyId) {
    return { skip: false, replyDepth: 0 };
  }

  const { data: parentReply } = await supabase
    .from('thread_replies')
    .select('persona_id, error_details')
    .eq('reply_id', parentReplyId)
    .maybeSingle();

  if (!parentReply) {
    return { skip: false, replyDepth: 0 };
  }

  const parentDepthRaw = Number(parentReply.error_details?.reply_depth ?? 0);
  const parentDepth = Number.isFinite(parentDepthRaw) ? parentDepthRaw : 0;
  const replyDepth = parentDepth + 1;

  if (parentReply.persona_id && parentReply.persona_id !== persona.id) {
    return { skip: true, reason: 'cross_persona_parent_detected', replyDepth };
  }

  if (replyDepth > MAX_AUTO_REPLY_DEPTH) {
    return { skip: true, reason: 'reply_depth_limit_exceeded', replyDepth };
  }

  return { skip: false, replyDepth };
}

async function getBotUsernamesForUser(userId: string): Promise<Set<string>> {
  const botUsernames = new Set<string>();

  const { data: personas } = await supabase
    .from('personas')
    .select('name, threads_username')
    .eq('user_id', userId)
    .eq('is_active', true);

  for (const persona of personas || []) {
    if (persona.threads_username) {
      botUsernames.add(String(persona.threads_username).toLowerCase());
    }
    if (persona.name) {
      botUsernames.add(String(persona.name).toLowerCase());
    }
  }

  return botUsernames;
}

// トリガー自動返信（定型文）を処理
// 絵文字の正規化関数（threads-webhookと同じ実装）
async function processTemplateAutoReply(persona: any, reply: any): Promise<{ sent: boolean, method?: string }> {
  console.log(`🎯 定型文自動返信チェック開始`);

  // 自動返信設定を取得
  const { data: autoRepliesSettings } = await supabase
    .from('auto_replies')
    .select('*')
    .eq('persona_id', persona.id)
    .eq('is_active', true);

  if (!autoRepliesSettings || autoRepliesSettings.length === 0) {
    console.log(`❌ 定型文自動返信設定なし - persona: ${persona.name}`);
    return { sent: false };
  }

  console.log(`✅ 定型文自動返信設定が有効 - persona: ${persona.name}, 設定数: ${autoRepliesSettings.length}`);

  const replyText = reply.text || '';
  const normalizedReply = normalizeEmojiAndText(replyText);
  console.log(`🔍 リプライテキスト: "${replyText}" → 正規化: "${normalizedReply}"`);

  for (const setting of autoRepliesSettings) {
    const keywords = setting.trigger_keywords || [];
    console.log(`🔑 チェック中のキーワード:`, keywords);

    for (const keyword of keywords) {
      const normalizedKeyword = normalizeEmojiAndText(keyword);
      console.log(`🔍 キーワード "${keyword}" → 正規化: "${normalizedKeyword}" をテキストと照合中`);
      
      if (isKeywordMatch(replyText, keyword)) {
        console.log(`🎉 キーワードマッチ成功: "${keyword}" → 返信: "${setting.response_template}"`);
        
        try {
          // 遅延時間を取得（定型文設定の遅延時間またはペルソナのデフォルト遅延時間）
          const delayMinutes = setting.delay_minutes || persona.auto_reply_delay_minutes || 0;
          
          if (delayMinutes > 0) {
            console.log(`⏰ 定型文返信を${delayMinutes}分後にスケジュール - reply: ${reply.id}`);
            
            // スケジュール時刻を計算
            const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
            
            // thread_repliesのscheduled_reply_atとai_response（定型文）を保存
            await supabase
              .from('thread_replies')
              .update({ 
                ai_response: setting.response_template,  // 定型文を保存
                scheduled_reply_at: scheduledTime.toISOString(),
                reply_status: 'scheduled',  // 遅延送信のためscheduledステータスを使用
                auto_reply_sent: false  // ★ スケジュール時はまだ未送信
              })
              .eq('reply_id', reply.id);
            
            // アクティビティログを記録
            await logActivity(persona.user_id, persona.id, 'template_auto_reply_scheduled',
              `定型文自動返信をスケジュール: "${setting.response_template.substring(0, 50)}..." (${delayMinutes}分後)`, {
                reply_id: reply.id,
                keyword_matched: keyword,
                response_template: setting.response_template,
                scheduled_for: scheduledTime.toISOString(),
                delay_minutes: delayMinutes
              });

            console.log(`✅ 定型文返信スケジュール成功 - ${delayMinutes}分後: ${scheduledTime.toISOString()}`);
            return { sent: true, method: 'template_scheduled' };
          } else {
            // 遅延時間が0分の場合は即座に送信
            console.log(`📤 定型文返信を即座に送信 - reply: ${reply.id}`);
            const accessToken = await getAccessToken(persona);
             if (!accessToken) {
              console.error('❌ アクセストークン取得失敗');
              await supabase
                .from('thread_replies')
                .update({ 
                  reply_status: 'failed',
                  auto_reply_sent: false  // ★ リトライ可能にする
                })
                .eq('reply_id', reply.id);
              return { sent: false };
            }
            const success = await sendThreadsReply(persona, accessToken, reply.id, setting.response_template);
            
            if (success) {
              console.log(`✅ 定型文返信送信成功`);
              // 送信成功時にステータスを更新
              await supabase
                .from('thread_replies')
                .update({ 
                  reply_status: 'sent',
                  auto_reply_sent: true  // ★ 送信完了を記録
                })
                .eq('reply_id', reply.id);
              
              // アクティビティログを記録
              await logActivity(persona.user_id, persona.id, 'template_auto_reply_sent',
                `定型文自動返信を送信: "${setting.response_template.substring(0, 50)}..."`, {
                  reply_id: reply.id,
                  keyword_matched: keyword,
                  response_sent: setting.response_template
                });

              return { sent: true, method: 'template' };
            } else {
              console.error(`❌ 定型文返信送信失敗`);
              // 送信失敗時はステータスを更新
              await supabase
                .from('thread_replies')
                .update({ 
                  reply_status: 'failed',
                  auto_reply_sent: false  // ★ リトライ可能にする
                })
                .eq('reply_id', reply.id);
            }
          }
        } catch (error) {
          console.error(`❌ 定型文返信送信エラー:`, error);
        }
      }
    }
  }

  console.log(`❌ マッチするキーワードなし`);
  return { sent: false };
}


// アクセストークンを取得（直接復号 - cryptoモジュール使用）
async function getAccessToken(persona: any): Promise<string | null> {
  try {
    console.log('🔑 アクセストークン取得開始（直接復号方式）');

    // Step 1: user_api_keysから暗号化キーを取得して直接復号
    const decryptedFromDb = await getUserApiKeyDecrypted(
      supabase, persona.user_id, 'threads_access_token'
    );
    
    if (decryptedFromDb) {
      console.log('✅ user_api_keysから復号成功');
      return decryptedFromDb;
    }

    // Step 2: personasテーブルのトークンを直接復号
    const { data: personaWithToken } = await supabase
      .from('personas')
      .select('threads_access_token')
      .eq('id', persona.id)
      .maybeSingle();

    if (!personaWithToken?.threads_access_token) {
      console.error('❌ アクセストークンが見つかりません');
      return null;
    }

    const token = await decryptIfNeeded(
      personaWithToken.threads_access_token,
      `check-replies:getAccessToken:${persona.id}`
    );
    
    if (token) {
      console.log('✅ personasテーブルから復号成功');
      return token;
    }

    console.error('❌ 全ての方式でアクセストークン取得失敗');
    return null;

  } catch (error) {
    console.error('❌ トークン取得エラー:', error);
    return null;
  }
}

// auto_reply_sentフラグを更新
async function updateAutoReplySentFlag(replyId: string, sent: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('thread_replies')
      .update({ auto_reply_sent: sent })
      .eq('reply_id', replyId);
    
    if (error) {
      console.error('❌ auto_reply_sentフラグ更新エラー:', error);
    } else {
      console.log(`✅ auto_reply_sentフラグ更新完了: ${replyId} -> ${sent}`);
    }
  } catch (error) {
    console.error('❌ auto_reply_sentフラグ更新エラー:', error);
  }
}

// アクティビティログを記録
async function logActivity(userId: string, personaId: string, actionType: string, description: string, metadata?: any): Promise<void> {
  try {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        persona_id: personaId,
        action_type: actionType,
        description: description,
        metadata: metadata || {}
      });
    
    console.log(`📝 アクティビティログ記録: ${actionType}`);
  } catch (error) {
    console.error('❌ アクティビティログ記録エラー:', error);
  }
}

// スケジュールされた返信を処理
async function processScheduledReplies(): Promise<void> {
  try {
    console.log('🕒 スケジュールされた返信をチェック中...');
    
    // CRITICAL FIX: JOINを使わず個別クエリ（重複FK回避）
    const { data: scheduledReplies, error } = await supabase
      .from('thread_replies')
      .select('*')
      .eq('reply_status', 'scheduled')
      .lte('scheduled_reply_at', new Date().toISOString());

    if (error) {
      console.error('❌ スケジュール返信取得エラー:', error);
      return;
    }

    if (!scheduledReplies || scheduledReplies.length === 0) {
      console.log('📝 送信予定の返信はありません');
      return;
    }

    console.log(`📤 ${scheduledReplies.length}件のスケジュール返信を処理中...`);

    for (const reply of scheduledReplies) {
      // ペルソナ情報を個別に取得（重複FK回避）
      const { data: persona } = await supabase
        .from('personas')
        .select('id, name, user_id, threads_access_token, ai_auto_reply_enabled, auto_reply_enabled, auto_reply_delay_minutes, is_active')
        .eq('id', reply.persona_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (!persona) {
        console.log(`⏭️ ペルソナが見つかりません: ${reply.persona_id}`);
        continue;
      }
      
      try {
        // ★ CRITICAL: アトミックロック - 二重送信防止
        const { data: lockResult, error: lockError } = await supabase
          .from('thread_replies')
          .update({ 
            auto_reply_sent: true,
            reply_status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('reply_id', reply.reply_id)
          .eq('auto_reply_sent', false)
          .eq('reply_status', 'scheduled')
          .select('id');
        
        if (lockError || !lockResult || lockResult.length === 0) {
          console.log(`⏭️ スケジュール返信ロック取得失敗（既に処理中）: ${reply.reply_id}`);
          continue;
        }
        
        console.log(`🔒 スケジュール返信ロック取得成功: ${reply.reply_id}`);

        // アクセストークンを取得
        const accessToken = await getAccessToken(persona);
        if (!accessToken) {
          console.error(`❌ アクセストークン取得失敗 - persona: ${persona.name}`);
          // ロック解放
          await supabase
            .from('thread_replies')
            .update({ auto_reply_sent: false, reply_status: 'scheduled' })
            .eq('reply_id', reply.reply_id);
          continue;
        }

        // activity_logsから返信内容を取得（AI返信または定型文返信）
        const { data: activityLogs } = await supabase
          .from('activity_logs')
          .select('metadata, action_type')
          .in('action_type', ['ai_auto_reply_scheduled', 'template_auto_reply_scheduled'])
          .eq('metadata->reply_id', reply.reply_id)
          .order('created_at', { ascending: false })
          .limit(1);

        let responseContent = null;
        if (activityLogs && activityLogs.length > 0) {
          const log = activityLogs[0];
          if (log.action_type === 'ai_auto_reply_scheduled') {
            responseContent = log.metadata?.ai_response;
          } else if (log.action_type === 'template_auto_reply_scheduled') {
            responseContent = log.metadata?.response_template;
          }
        }

        // activity_logsになければ、thread_repliesのai_responseを使用
        if (!responseContent && reply.ai_response) {
          responseContent = reply.ai_response;
          console.log(`📋 thread_repliesからAI返信を取得: "${responseContent.substring(0, 50)}..."`);
        }

        if (!responseContent) {
          console.error(`❌ 返信内容が見つかりません - reply: ${reply.reply_id}`);
          // ロック解放
          await supabase
            .from('thread_replies')
            .update({ auto_reply_sent: false, reply_status: 'failed' })
            .eq('reply_id', reply.reply_id);
          continue;
        }

        // Threads APIで返信送信
        console.log(`📤 スケジュール返信送信中: ${reply.reply_id}`);
        const success = await sendThreadsReply(persona, accessToken, reply.reply_id, responseContent);

        if (success) {
          // 成功時：reply_statusを'sent'に（auto_reply_sentは既にtrue）
          await supabase
            .from('thread_replies')
            .update({ 
              reply_status: 'sent',
              scheduled_reply_at: null
            })
            .eq('reply_id', reply.reply_id);

          // アクティビティログを記録
          await logActivity(persona.user_id, persona.id, 'scheduled_reply_sent',
            `スケジュール返信送信完了: "${responseContent.substring(0, 50)}..."`, {
              reply_id: reply.reply_id,
              scheduled_time: reply.scheduled_reply_at,
              sent_time: new Date().toISOString()
            });

          console.log(`✅ スケジュール返信送信成功: ${reply.reply_id}`);
        } else {
          // 失敗時：ロック解放 + retry_countを増やす（3回まで）
          const retryCount = (reply.retry_count || 0) + 1;
          if (retryCount >= 3) {
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'failed',
                auto_reply_sent: true  // ★ 最大リトライ到達 → 再トリガー防止
              })
              .eq('reply_id', reply.reply_id);
            console.error(`❌ スケジュール返信送信失敗（最大リトライ到達）: ${reply.reply_id}`);
          } else {
            // 5分後に再試行 - ★ ロック解放して再試行可能に
            const nextRetry = new Date(Date.now() + 5 * 60 * 1000);
            await supabase
              .from('thread_replies')
              .update({ 
                reply_status: 'scheduled',
                auto_reply_sent: false,  // ★ ロック解放
                scheduled_reply_at: nextRetry.toISOString(),
                retry_count: retryCount
              })
              .eq('reply_id', reply.reply_id);
            console.log(`🔄 スケジュール返信リトライ設定: ${reply.reply_id} (${retryCount}/3)`);
          }
        }

      } catch (error) {
        console.error(`❌ スケジュール返信処理エラー - reply: ${reply.reply_id}:`, error);
      }
    }

  } catch (error) {
    console.error('❌ スケジュール返信処理エラー:', error);
  }
}

// Threads APIで返信送信
async function sendThreadsReply(persona: any, accessToken: string, replyToId: string, responseText: string): Promise<boolean> {
  try {
    console.log(`📤 Threads返信送信開始: "${responseText}" (Reply to: ${replyToId})`);

    // コンテナを作成
    const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: responseText,
        reply_to_id: replyToId,
        access_token: accessToken
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Threads コンテナ作成失敗:', errorText);
      return false;
    }

    const containerData = await createResponse.json();
    console.log(`✅ コンテナ作成成功: ${containerData.id}`);

    // 少し待機してから投稿
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 投稿を公開
    const publishResponse = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: accessToken
      })
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      console.error('❌ Threads 投稿公開失敗:', errorText);
      return false;
    }

    const publishData = await publishResponse.json();
    console.log(`🎉 返信送信成功: ${publishData.id}`);
    return true;

  } catch (error) {
    console.error('❌ Threads返信送信エラー:', error);
    return false;
  }
}

