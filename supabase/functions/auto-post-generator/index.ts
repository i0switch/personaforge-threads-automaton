import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getUserApiKey(userId: string, keyName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('key_name', keyName)
      .single();

    if (error || !data) return null;

    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    if (!encryptionKey) return null;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encryptedData = Uint8Array.from(atob(data.encrypted_key), c => c.charCodeAt(0));
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    // Try current AES-GCM (raw key padded to 32 bytes)
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        keyMaterial,
        ciphertext
      );
      return decoder.decode(decrypted);
    } catch (_e) {
      // Fallback: legacy PBKDF2-derived AES-GCM
      try {
        const baseKey = await crypto.subtle.importKey(
          'raw',
          encoder.encode(encryptionKey),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: encoder.encode('salt'),
            iterations: 100000,
            hash: 'SHA-256',
          },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          derivedKey,
          ciphertext
        );
        console.log('Legacy key decryption succeeded (PBKDF2 fallback).');
        return decoder.decode(decrypted);
      } catch (e2) {
        console.error('Failed to decrypt user API key with both methods:', e2);
        return null;
      }
    }
  } catch (e) {
    console.error('Failed to get user API key:', e);
    return null;
  }
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('Gemini API key is not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned empty content');
  return text.trim();
}

function buildPrompt(persona: any, customPrompt?: string, contentPrefs?: string) {
  const personaInfo = [
    `ペルソナ名: ${persona?.name || '未設定'}`,
    persona?.tone_of_voice ? `口調: ${persona.tone_of_voice}` : undefined,
    persona?.expertise?.length ? `専門領域: ${persona.expertise.join(', ')}` : undefined,
    persona?.personality ? `性格: ${persona.personality}` : undefined,
  ].filter(Boolean).join('\n');

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         (contentPrefs ? `--- 投稿方針 ---\n${contentPrefs}\n` : '') +
         (customPrompt ? `--- カスタムプロンプト ---\n${customPrompt}\n` : '') +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

function buildRandomPrompt(persona: any) {
  const personaInfo = [
    `ペルソナ名: ${persona?.name || '未設定'}`,
    persona?.tone_of_voice ? `口調: ${persona.tone_of_voice}` : undefined,
    persona?.expertise?.length ? `専門領域: ${persona.expertise.join(', ')}` : undefined,
    persona?.personality ? `性格: ${persona.personality}` : undefined,
  ].filter(Boolean).join('\n');

  const randomTopics = [
    '今日の体験や気づき',
    '専門分野についての洞察',
    '日常の小さな発見',
    'おすすめの方法やコツ',
    '最近感じたこと',
    '役立つ情報の共有',
    'トレンドについての意見',
    '個人的な価値観'
  ];

  const selectedTopic = randomTopics[Math.floor(Math.random() * randomTopics.length)];

  return `あなたは指定されたペルソナになりきってThreads用の短文投稿を1件だけ出力します。\n` +
         `今回のテーマ: ${selectedTopic}\n` +
         `出力はテキスト本文のみ。絵文字やハッシュタグの使用は内容に応じて自然に。\n` +
         `--- ペルソナ情報 ---\n${personaInfo}\n` +
         `--- 投稿方針 ---\n` +
         `- このペルソナらしい自然な投稿内容にする\n` +
         `- テーマに沿いつつも、個性を活かした内容にする\n` +
         `- フォロワーに価値を提供する内容を心がける\n` +
         `--- 出力ルール ---\n- 280文字程度以内\n- 攻撃的・不適切表現は禁止\n- 改行2回以内\n- 出力はテキスト本文のみ`;
}

function calculateRandomNextRun(randomTimes: string[], timezone: string = 'UTC'): string {
  if (!randomTimes || randomTimes.length === 0) {
    // デフォルト時間（9時、12時、18時）から選択
    const defaultTimes = ['09:00:00', '12:00:00', '18:00:00'];
    randomTimes = defaultTimes;
  }

  // 次の日のランダムな時間を選択
  const randomTime = randomTimes[Math.floor(Math.random() * randomTimes.length)];
  const [hours, minutes] = randomTime.split(':').map(Number);
  
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 1); // 明日
  nextRun.setHours(hours, minutes, 0, 0);
  
  return nextRun.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();

    // 1. 通常のオートポスト設定を取得
    const { data: configs, error: cfgError } = await supabase
      .from('auto_post_configs')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .limit(25);

    if (cfgError) throw cfgError;

    // 2. ランダムポスト設定を取得
    const { data: randomConfigs, error: randomCfgError } = await supabase
      .from('random_post_configs')
      .select('*, personas!inner(id, user_id, name, tone_of_voice, expertise, personality)')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .limit(25);

    if (randomCfgError) throw randomCfgError;

    let processed = 0, posted = 0, failed = 0;

    // 3. 通常のオートポスト処理
    for (const cfg of configs || []) {
      try {
        processed++;

        // ペルソナ情報取得
        const { data: persona, error: personaError } = await supabase
          .from('personas')
          .select('id, user_id, name, tone_of_voice, expertise, personality')
          .eq('id', cfg.persona_id)
          .single();
        if (personaError) throw personaError;

        // APIキー解決（個人APIキー必須）
        const userGeminiApiKey = await getUserApiKey(cfg.user_id, 'GEMINI_API_KEY');
        if (!userGeminiApiKey) {
          console.error(`User ${cfg.user_id} does not have GEMINI_API_KEY configured, skipping post generation`);
          failed++;
          continue;
        }
        const geminiApiKeyToUse = userGeminiApiKey;
        // 生成
        const prompt = buildPrompt(persona, cfg.prompt_template, cfg.content_prefs);
        const content = await generateWithGemini(prompt, geminiApiKeyToUse);

        // postsへ作成（予約投稿）
        const { data: inserted, error: postErr } = await supabase
          .from('posts')
          .insert({
            user_id: cfg.user_id,
            persona_id: cfg.persona_id,
            content,
            status: 'scheduled',
            scheduled_for: cfg.next_run_at,
            auto_schedule: true,
            platform: 'threads'
          })
          .select('id')
          .single();
        if (postErr) throw postErr;

        // post_queueに投入（オートスケジューラが処理）
        const { error: queueErr } = await supabase
          .from('post_queue')
          .insert({
            user_id: cfg.user_id,
            post_id: inserted.id,
            scheduled_for: cfg.next_run_at,
            queue_position: 0,
            status: 'queued'
          });
        if (queueErr) throw queueErr;

        // 次回実行時刻を計算（複数時間対応）
        let nextRunAt: string;
        
        if (cfg.multi_time_enabled && cfg.post_times && cfg.post_times.length > 0) {
          // 複数時間設定の場合：次の時間スロットを計算
          const { data: nextTime, error: calcErr } = await supabase
            .rpc('calculate_next_multi_time_run', {
              p_current_time: new Date().toISOString(),
              time_slots: cfg.post_times,
              timezone_name: cfg.timezone || 'UTC'
            });
          
          if (calcErr) {
            console.error('Failed to calculate next multi-time run:', calcErr);
            // フォールバック: 従来の方法で次の日の同時刻
            const next = new Date(cfg.next_run_at);
            next.setDate(next.getDate() + 1);
            nextRunAt = next.toISOString();
          } else {
            nextRunAt = nextTime;
          }
        } else {
          // 従来の単一時間設定：次の日の同時刻
          const next = new Date(cfg.next_run_at);
          next.setDate(next.getDate() + 1);
          nextRunAt = next.toISOString();
        }

        const { error: updErr } = await supabase
          .from('auto_post_configs')
          .update({ next_run_at: nextRunAt })
          .eq('id', cfg.id);
        if (updErr) throw updErr;

        posted++;
      } catch (e) {
        console.error('Auto post generation failed:', e);
        failed++;
      }
    }

    // 4. ランダムポスト処理
    for (const randomCfg of randomConfigs || []) {
      try {
        processed++;

        const persona = randomCfg.personas;
        if (!persona) continue;

        // 該当ペルソナの完全オートポスト設定を取得
        const { data: autoConfigs, error: autoConfigError } = await supabase
          .from('auto_post_configs')
          .select('prompt_template, content_prefs')
          .eq('persona_id', persona.id)
          .eq('is_active', true);

        if (autoConfigError) {
          console.error('Failed to get auto post configs for random post:', autoConfigError);
          continue;
        }

        if (!autoConfigs || autoConfigs.length === 0) {
          console.log(`No active auto post configs found for persona ${persona.name}, skipping random post`);
          continue;
        }

        // 完全オートポスト設定からランダムに1つ選択
        const selectedConfig = autoConfigs[Math.floor(Math.random() * autoConfigs.length)];
        console.log(`Selected random config for ${persona.name}:`, {
          prompt_template: selectedConfig.prompt_template?.substring(0, 50) + '...',
          content_prefs: selectedConfig.content_prefs?.substring(0, 50) + '...'
        });

        // APIキー解決（個人APIキー必須）
        const userGeminiApiKey = await getUserApiKey(persona.user_id, 'GEMINI_API_KEY');
        if (!userGeminiApiKey) {
          console.error(`User ${persona.user_id} does not have GEMINI_API_KEY configured, skipping random post generation`);
          failed++;
          continue;
        }
        const geminiApiKeyToUse = userGeminiApiKey;

        // 選択した完全オートポスト設定を使用してプロンプト生成
        const prompt = buildPrompt(persona, selectedConfig.prompt_template, selectedConfig.content_prefs);
        const content = await generateWithGemini(prompt, geminiApiKeyToUse);

        // postsへ作成（予約投稿）
        const { data: inserted, error: postErr } = await supabase
          .from('posts')
          .insert({
            user_id: persona.user_id,
            persona_id: persona.id,
            content,
            status: 'scheduled',
            scheduled_for: randomCfg.next_run_at,
            auto_schedule: true,
            platform: 'threads'
          })
          .select('id')
          .single();
        if (postErr) throw postErr;

        // post_queueに投入（オートスケジューラが処理）
        const { error: queueErr } = await supabase
          .from('post_queue')
          .insert({
            user_id: persona.user_id,
            post_id: inserted.id,
            scheduled_for: randomCfg.next_run_at,
            queue_position: 0,
            status: 'queued'
          });
        if (queueErr) throw queueErr;

        // 次回実行時刻をランダムに選択
        const nextRunAt = calculateRandomNextRun(randomCfg.random_times, randomCfg.timezone);

        const { error: updErr } = await supabase
          .from('random_post_configs')
          .update({ next_run_at: nextRunAt })
          .eq('id', randomCfg.id);
        if (updErr) throw updErr;

        posted++;
      } catch (e) {
        console.error('Random post generation failed:', e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'auto-post-generator completed', 
        processed, 
        posted, 
        failed,
        regular_configs: configs?.length || 0,
        random_configs: randomConfigs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('auto-post-generator error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
