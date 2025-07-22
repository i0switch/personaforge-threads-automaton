import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    console.log('=== CHECK-REPLIES FUNCTION STARTED ===');
    console.log('Starting reply check...');

    // アクティブなリプライチェック設定を取得
    const { data: checkSettings, error: settingsError } = await supabase
      .from('reply_check_settings')
      .select('*')
      .eq('is_active', true);

    console.log('Reply check settings found:', checkSettings?.length || 0);
    
    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
    }

    // リプライチェック設定がない場合、アクティブなペルソナを直接取得
    let personasToCheck = [];
    
    if (!checkSettings || checkSettings.length === 0) {
      console.log('No reply check settings found, getting active personas directly');
      const { data: activePersonas } = await supabase
        .from('personas')
        .select('*')
        .eq('is_active', true)
        .not('threads_access_token', 'is', null);
      
      personasToCheck = activePersonas || [];
      console.log('Active personas found:', personasToCheck.length);
    } else {
      // リプライチェック設定からユーザーIDを取得し、そのユーザーのペルソナを取得
      const userIds = [...new Set(checkSettings.map(s => s.user_id))];
      console.log('Getting personas for user IDs:', userIds);
      
      const { data: personas, error: personasError } = await supabase
        .from('personas')
        .select('*')
        .in('user_id', userIds)
        .eq('is_active', true)
        .not('threads_access_token', 'is', null);
        
      if (personasError) {
        console.error('Error fetching personas:', personasError);
      }
      
      personasToCheck = personas || [];
      console.log('Personas found for settings:', personasToCheck.length);
    }

    if (personasToCheck.length === 0) {
      console.log('No personas to check');
      return new Response(JSON.stringify({ message: 'No personas to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    let totalRepliesFound = 0;

    for (const persona of personasToCheck) {
      if (!persona?.threads_access_token) {
        console.log(`Skipping persona ${persona?.id} - no access token`);
        continue;
      }

      try {
        console.log(`Checking replies for persona: ${persona.name}`);

        // 最近投稿された投稿のIDを取得
        const { data: recentPosts } = await supabase
          .from('posts')
          .select('id, content, published_at')
          .eq('persona_id', persona.id)
          .eq('status', 'published')
          .not('published_at', 'is', null)
          .order('published_at', { ascending: false })
          .limit(10);

        if (!recentPosts || recentPosts.length === 0) {
          console.log(`No recent posts found for persona ${persona.id}`);
          continue;
        }

        // 各投稿のリプライをチェック
        for (const post of recentPosts) {
          const repliesFound = await checkRepliesForPost(persona, post.id);
          totalRepliesFound += repliesFound;
        }

        // 既存の未処理リプライをチェック
        await checkExistingReplies(persona);

        // 最後のチェック時刻を更新（リプライチェック設定がある場合のみ）
        if (checkSettings && checkSettings.length > 0) {
          const setting = checkSettings.find(s => s.user_id === persona.user_id);
          if (setting) {
            await supabase
              .from('reply_check_settings')
              .update({ last_check_at: new Date().toISOString() })
              .eq('id', setting.id);
          }
        }

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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// 定型文返信チェック関数（強化版）
async function checkKeywordAutoReply(persona: any, thread: any) {
  try {
    console.log(`=== キーワード自動返信チェック開始 ===`);
    console.log(`ペルソナ: ${persona.name} (ID: ${persona.id})`);
    console.log(`リプライ内容: "${thread.text}"`);
    console.log(`リプライID: ${thread.id}`);
    
    // このユーザーの定型文返信設定を取得
    const { data: autoReplies, error: fetchError } = await supabase
      .from('auto_replies')
      .select('*')
      .eq('user_id', persona.user_id)
      .eq('is_active', true);

    if (fetchError) {
      console.error(`定型文返信設定の取得エラー:`, fetchError);
      return;
    }

    if (!autoReplies || autoReplies.length === 0) {
      console.log(`ユーザー ${persona.user_id} の有効な定型文返信設定が見つかりません`);
      return;
    }

    console.log(`見つかった定型文返信設定: ${autoReplies.length}件`);
    autoReplies.forEach((reply, index) => {
      console.log(`設定${index + 1}: キーワード=[${reply.trigger_keywords?.join(', ')}], 返信="${reply.response_template}"`);
    });

    const replyText = (thread.text || '').toLowerCase().trim();
    console.log(`検索対象テキスト（小文字変換後）: "${replyText}"`);
    
    // キーワードマッチングチェック
    for (const autoReply of autoReplies) {
      const keywords = autoReply.trigger_keywords || [];
      console.log(`チェック中の設定: キーワード=[${keywords.join(', ')}]`);
      
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase().trim();
        console.log(`キーワード "${keyword}" (小文字: "${keywordLower}") をチェック中...`);
        
        if (replyText.includes(keywordLower)) {
          console.log(`🎯 キーワード "${keyword}" がマッチしました！`);
          console.log(`返信テンプレート: "${autoReply.response_template}"`);
          
          // 遅延設定に基づいて返信をスケジュール
          const delayMinutes = autoReply.delay_minutes || 0;
          console.log(`遅延設定: ${delayMinutes}分`);
          
          if (delayMinutes > 0) {
            const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
            console.log(`スケジュール返信時刻: ${scheduledAt}`);
            
            // 遅延返信の場合：scheduled_reply_atを設定
            const { error: updateError } = await supabase
              .from('thread_replies')
              .update({
                reply_status: 'scheduled',
                scheduled_reply_at: scheduledAt
              })
              .eq('reply_id', thread.id);
            
            if (updateError) {
              console.error(`スケジュール返信の設定エラー:`, updateError);
            } else {
              console.log(`✅ スケジュール返信が設定されました (${delayMinutes}分後)`);
            }
          } else {
            // 即座に返信
            console.log(`即座返信を実行します`);
            await sendKeywordReply(persona, thread, autoReply.response_template);
            
            // 即座返信の場合はすぐにステータスを更新
            const { error: updateError } = await supabase
              .from('thread_replies')
              .update({
                reply_status: 'sent',
                auto_reply_sent: true
              })
              .eq('reply_id', thread.id);
              
            if (updateError) {
              console.error(`即座返信ステータス更新エラー:`, updateError);
            } else {
              console.log(`✅ 即座返信完了`);
            }
          }
          
          console.log(`=== キーワード自動返信チェック完了（マッチあり）===`);
          return; // 最初のマッチで終了
        } else {
          console.log(`キーワード "${keyword}" はマッチしませんでした`);
        }
      }
    }
    
    console.log(`❌ マッチするキーワードが見つかりませんでした`);
    console.log(`=== キーワード自動返信チェック完了（マッチなし）===`);
  } catch (error) {
    console.error(`キーワード自動返信チェックエラー:`, error);
  }
}

// 定型文返信を送信する関数
async function sendKeywordReply(persona: any, thread: any, responseTemplate: string) {
  try {
    console.log(`=== 定型文返信送信開始 ===`);
    console.log(`ペルソナ: ${persona.name}`);
    console.log(`返信内容: "${responseTemplate}"`);
    console.log(`返信先スレッドID: ${thread.id}`);
    
    // Step 1: Create the reply container
    console.log('Step 1: Creating reply container...');
    const createResponse = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: responseTemplate,
        reply_to_id: thread.id,
        access_token: persona.threads_access_token
      })
    });

    const createResponseText = await createResponse.text();
    console.log(`Create response status: ${createResponse.status}`);
    console.log(`Create response body: ${createResponseText}`);

    if (!createResponse.ok) {
      throw new Error(`Failed to create reply container: ${createResponse.status} - ${createResponseText}`);
    }

    const createResult = JSON.parse(createResponseText);
    const containerId = createResult.id;
    console.log(`✅ Reply container created: ${containerId}`);

    // Step 2: Publish the reply
    console.log('Step 2: Publishing reply...');
    const publishResponse = await fetch(`https://graph.threads.net/v1.0/${containerId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: persona.threads_access_token
      })
    });

    const publishResponseText = await publishResponse.text();
    console.log(`Publish response status: ${publishResponse.status}`);
    console.log(`Publish response body: ${publishResponseText}`);

    if (!publishResponse.ok) {
      throw new Error(`Failed to publish reply: ${publishResponse.status} - ${publishResponseText}`);
    }

    const publishResult = JSON.parse(publishResponseText);
    console.log(`✅ Reply published successfully: ${publishResult.id}`);
    
    // 活動ログに記録
    await supabase
      .from('activity_logs')
      .insert({
        user_id: persona.user_id,
        persona_id: persona.id,
        action_type: 'keyword_auto_reply_sent',
        description: `Keyword auto-reply sent to thread ${thread.id}`,
        metadata: {
          original_reply: thread.text,
          auto_reply_text: responseTemplate,
          thread_id: thread.id,
          container_id: containerId,
          published_post_id: publishResult.id
        }
      });
      
    console.log(`=== 定型文返信送信完了 ===`);
    return publishResult;
        
  } catch (error) {
    console.error(`=== 定型文返信送信エラー ===`);
    console.error(`エラー詳細:`, error);
    
    // エラー状態を記録
    await supabase
      .from('thread_replies')
      .update({
        reply_status: 'failed'
      })
      .eq('reply_id', thread.id);
      
    throw error;
  }
}

// 既存の未処理リプライをチェックする関数
async function checkExistingReplies(persona: any) {
  try {
    console.log(`既存の未処理リプライをチェック中: ${persona.name}`);
    
    // 未処理の返信を取得（auto_reply_sent = false かつ reply_status = pending）
    const { data: existingReplies } = await supabase
      .from('thread_replies')
      .select('*')
      .eq('persona_id', persona.id)
      .eq('auto_reply_sent', false)
      .eq('reply_status', 'pending');

    if (!existingReplies || existingReplies.length === 0) {
      console.log(`ペルソナ ${persona.id} の未処理リプライは見つかりませんでした`);
      return;
    }

    console.log(`見つかった未処理リプライ: ${existingReplies.length}件`);

    for (const reply of existingReplies) {
      console.log(`処理中のリプライ: ID=${reply.reply_id}, テキスト="${reply.reply_text}"`);
      
      // 模擬threadオブジェクトを作成
      const mockThread = {
        id: reply.reply_id,
        text: reply.reply_text,
        username: reply.reply_author_username,
        timestamp: reply.reply_timestamp
      };

      // キーワードマッチングチェック
      await checkKeywordAutoReply(persona, mockThread);
    }
  } catch (error) {
    console.error(`既存リプライチェックエラー (ペルソナ ${persona.id}):`, error);
  }
}

async function checkRepliesForPost(persona: any, postId: string): Promise<number> {
  try {
    // Threads APIを使用してメンション・リプライを検索
    // Note: Threads APIの実際のエンドポイントは公式ドキュメントを確認してください
    const response = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,username,timestamp,reply_to_id&access_token=${persona.threads_access_token}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch threads for persona ${persona.id}:`, response.status);
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

          // すでに保存されているかチェック
          const { data: existingReply } = await supabase
            .from('thread_replies')
            .select('id')
            .eq('reply_id', thread.id)
            .single();

          if (!existingReply) {
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
                reply_timestamp: new Date(thread.timestamp || Date.now()).toISOString()
              });

            if (!insertError) {
              newRepliesCount++;
              console.log(`New reply saved: ${thread.id}`);

              // 定型文返信チェック（キーワードマッチング）
              await checkKeywordAutoReply(persona, thread);

              // AI自動返信チェック
              if (persona.ai_auto_reply_enabled) {
                console.log(`Triggering AI auto-reply for persona ${persona.name}`);
                try {
                  const { data: autoReplyResponse, error: autoReplyError } = await supabase.functions.invoke('threads-auto-reply', {
                    body: {
                      postContent: '', // 元投稿の内容
                      replyContent: thread.text,
                      replyId: thread.id,
                      personaId: persona.id,
                      userId: persona.user_id
                    }
                  });

                  if (autoReplyError) {
                    console.error(`Auto-reply error for ${thread.id}:`, autoReplyError);
                  } else {
                    console.log(`Auto-reply sent for ${thread.id}:`, autoReplyResponse);
                  }
                } catch (autoReplyErr) {
                  console.error(`Failed to send auto-reply for ${thread.id}:`, autoReplyErr);
                }
              }
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
