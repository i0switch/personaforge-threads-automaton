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

async function getAllGeminiApiKeys(userId: string): Promise<string[]> {
  const apiKeys: string[] = [];
  
  // Try all possible Gemini API keys (1-10)
  for (let i = 1; i <= 10; i++) {
    const keyName = i === 1 ? 'GEMINI_API_KEY' : `GEMINI_API_KEY_${i}`;
    const apiKey = await getUserApiKey(userId, keyName);
    if (apiKey) {
      apiKeys.push(apiKey);
    }
  }
  
  return apiKeys;
}

async function generateWithGeminiRotation(prompt: string, userId: string): Promise<string> {
  const apiKeys = await getAllGeminiApiKeys(userId);
  
  if (apiKeys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length}`);
    
    try {
      const result = await generateWithGemini(prompt, apiKey);
      console.log(`Successfully generated content with API key ${i + 1}`);
      return result;
    } catch (error) {
      console.log(`API key ${i + 1} failed:`, error.message);
      lastError = error;
      
      // Check if it's a quota/rate limit error that should trigger rotation
      if (error.message.includes('429') || 
          error.message.includes('quota') || 
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('Rate limit')) {
        console.log(`Rate limit/quota error detected, trying next API key...`);
        continue;
      } else {
        // For other errors, don't continue trying other keys
        throw error;
      }
    }
  }
  
  // If all keys failed, throw the last error
  throw lastError || new Error('All Gemini API keys failed');
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

  // 現在時刻をタイムゾーンに合わせて取得
  const now = new Date();
  const randomTime = randomTimes[Math.floor(Math.random() * randomTimes.length)];
  const [hours, minutes, seconds = 0] = randomTime.split(':').map(Number);
  
  // タイムゾーン考慮した次回実行時刻の計算
  if (timezone === 'UTC') {
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1); // 明日
    nextRun.setUTCHours(hours, minutes, seconds, 0);
    return nextRun.toISOString();
  } else {
    // Asia/Tokyo等のタイムゾーン対応
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const tomorrowLocal = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const localDateString = formatter.format(tomorrowLocal);
    
    // ローカル時間で次回実行時刻を作成し、UTCに変換
    const localDateTime = new Date(`${localDateString}T${randomTime}`);
    const utcOffset = getTimezoneOffset(timezone);
    const utcTime = new Date(localDateTime.getTime() - utcOffset * 60 * 1000);
    
    return utcTime.toISOString();
  }
}

// タイムゾーンオフセットを取得する関数
function getTimezoneOffset(timezone: string): number {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const targetTime = new Date(utc.toLocaleString("en-US", {timeZone: timezone}));
  return (utc.getTime() - targetTime.getTime()) / (1000 * 60);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();

    // 1. ランダムポスト設定がアクティブなペルソナIDを取得
    const { data: randomActivePersonas, error: randomPersonaError } = await supabase
      .from('random_post_configs')
      .select('persona_id')
      .eq('is_active', true);

    if (randomPersonaError) throw randomPersonaError;

    const excludePersonaIds = (randomActivePersonas || []).map(r => r.persona_id);
    console.log('🚫 Personas with active random post configs (will skip auto-post):', excludePersonaIds);

    // 2. 通常のオートポスト設定を取得（ランダムポスト設定がアクティブなペルソナは除外）
    let configsQuery = supabase
      .from('auto_post_configs')
      .select('*')
      .eq('is_active', true)  // 🔒 アクティブな設定のみ対象
      .lte('next_run_at', now.toISOString())
      .limit(25);

    // ランダムポスト設定がアクティブなペルソナは除外
    if (excludePersonaIds.length > 0) {
      configsQuery = configsQuery.not('persona_id', 'in', `(${excludePersonaIds.join(',')})`);
      console.log(`⚠️ Excluding ${excludePersonaIds.length} personas from auto-post due to active random posting`);
    }

    const { data: configs, error: cfgError } = await configsQuery;

    if (cfgError) throw cfgError;

    console.log(`📋 Found ${configs?.length || 0} auto-post configs to process (after random post exclusion)`);
    
    // ランダムポスト有効ペルソナの除外確認ログ
    if (configs && excludePersonaIds.length > 0) {
      const conflictingConfigs = configs.filter(cfg => excludePersonaIds.includes(cfg.persona_id));
      if (conflictingConfigs.length > 0) {
        console.error('⚠️ CONFLICT: Found auto-post configs for personas with active random posting:', 
          conflictingConfigs.map(c => c.persona_id));
      }
    }

    // 3. ランダムポスト設定を取得（すべてのアクティブな設定）
    const { data: randomConfigs, error: randomCfgError } = await supabase
      .from('random_post_configs')
      .select('*, personas!random_post_configs_persona_id_fkey(id, user_id, name, tone_of_voice, expertise, personality)')
      .eq('is_active', true)
      .limit(25);

    if (randomCfgError) throw randomCfgError;

    let processed = 0, posted = 0, failed = 0;

    // 4. 通常のオートポスト処理
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

        // APIキー解決とコンテンツ生成（エラー時は自動ローテーション）
        const prompt = buildPrompt(persona, cfg.prompt_template, cfg.content_prefs);
        const content = await generateWithGeminiRotation(prompt, cfg.user_id);

        console.log(`📝 Creating scheduled post for persona ${persona.name} at ${cfg.next_run_at}`);
        
        // 【重要】スケジュール時刻と状態を確実に設定
        const scheduledTime = cfg.next_run_at;
        if (!scheduledTime) {
          throw new Error(`No scheduled time available for persona ${persona.name}`);
        }
        
        console.log(`📊 About to create post with scheduled_for: ${scheduledTime}`);
        
        // postsへ作成（予約投稿）- トランザクションで確実に作成
        const { data: inserted, error: postErr } = await supabase
          .from('posts')
          .insert({
            user_id: cfg.user_id,
            persona_id: cfg.persona_id,
            content,
            status: 'scheduled',
            scheduled_for: scheduledTime,
            auto_schedule: true,
            platform: 'threads'
          })
          .select('id, status, scheduled_for, auto_schedule')
          .single();
          
        if (postErr) {
          console.error(`❌ Failed to create scheduled post for persona ${persona.name}:`, postErr);
          throw new Error(`Database error creating post: ${postErr.message}`);
        }
        
        if (!inserted) {
          throw new Error(`No data returned from post insertion for persona ${persona.name}`);
        }
        
        console.log(`✅ Post created with ID ${inserted.id}:`, {
          status: inserted.status,
          scheduled_for: inserted.scheduled_for,
          auto_schedule: inserted.auto_schedule
        });
        
        // 【重要】作成後の検証 - 問題があれば即座にエラー
        if (inserted.status !== 'scheduled') {
          const errorMsg = `CRITICAL: Post ${inserted.id} created with wrong status: ${inserted.status} (expected: scheduled)`;
          console.error(`🚨 ${errorMsg}`);
          throw new Error(errorMsg);
        }
        if (!inserted.scheduled_for) {
          const errorMsg = `CRITICAL: Post ${inserted.id} created without scheduled_for date`;
          console.error(`🚨 ${errorMsg}`);
          throw new Error(errorMsg);
        }

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
              p_current_time: now.toISOString(), // 現在時刻を使用
              time_slots: cfg.post_times,
              timezone_name: cfg.timezone || 'UTC'
            });
          
          if (calcErr) {
            console.error('Failed to calculate next multi-time run:', calcErr);
            // フォールバック: 翌日の最初の時間スロットを使用
            const firstTime = cfg.post_times[0];
            const nextDay = new Date(now);
            nextDay.setDate(nextDay.getDate() + 1);
            const [hours, minutes] = firstTime.split(':').map(Number);
            
            // タイムゾーンを考慮して翌日の最初の時間を設定
            if (cfg.timezone && cfg.timezone !== 'UTC') {
              // タイムゾーンを考慮した計算
              const localNextDay = new Date(nextDay.toLocaleString("en-US", {timeZone: cfg.timezone}));
              localNextDay.setHours(hours, minutes, 0, 0);
              nextRunAt = localNextDay.toISOString();
            } else {
              nextDay.setHours(hours, minutes, 0, 0);
              nextRunAt = nextDay.toISOString();
            }
          } else {
            nextRunAt = nextTime;
          }
          
          console.log(`📅 Multi-time persona ${cfg.persona_id}: Next run calculated as ${nextRunAt}`);
        } else {
          // 従来の単一時間設定：タイムゾーン考慮した次の日の同時刻
          const { data: nextTimeCalculated, error: calcErr } = await supabase
            .rpc('calculate_timezone_aware_next_run', {
              current_schedule_time: cfg.next_run_at,
              timezone_name: cfg.timezone || 'UTC'
            });
            
          if (calcErr) {
            console.error('Failed to calculate timezone-aware next run:', calcErr);
            const next = new Date(cfg.next_run_at);
            next.setDate(next.getDate() + 1);
            nextRunAt = next.toISOString();
          } else {
            nextRunAt = nextTimeCalculated;
          }
        }

        // 排他制御：設定更新前に現在の状態を確認
        const { data: currentConfig, error: checkError } = await supabase
          .from('auto_post_configs')
          .select('next_run_at, updated_at')
          .eq('id', cfg.id)
          .eq('is_active', true)
          .single();
          
        if (checkError || !currentConfig) {
          console.error(`設定 ${cfg.id} の確認に失敗またはすでに非アクティブ:`, checkError);
          failed++;
          processed++;
          continue;
        }
        
        // 次回実行時刻が変更されていないかチェック（並行実行防止）
        if (currentConfig.next_run_at !== cfg.next_run_at) {
          console.log(`⚠️ 設定 ${cfg.id} の次回実行時刻が既に更新済み。スキップします。`);
          processed++;
          continue;
        }

        // 設定を更新（楽観的排他制御）
        const { error: updateErr } = await supabase
          .from('auto_post_configs')
          .update({ 
            next_run_at: nextRunAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', cfg.id)
          .eq('next_run_at', cfg.next_run_at); // 元の値と一致する場合のみ更新
        
        if (updateErr) {
          console.error('Failed to update next_run_at for config', cfg.id, updateErr);
        } else {
          console.log(`✅ Config ${cfg.id} updated with next_run_at: ${nextRunAt}`);
        }

        posted++;
      } catch (e) {
        console.error('❌ Auto post generation failed for config', cfg.id, ':', e);
        failed++;
        
        // 【重要】エラー時は次回実行時刻を更新しない（無限ループ防止）
        console.log(`⚠️ Skipping next_run_at update for failed config ${cfg.id} to prevent infinite retries`);
      }
    }

    // 5. ランダムポスト処理（設定したすべての時間で投稿）
    for (const randomCfg of randomConfigs || []) {
      try {
        const persona = randomCfg.personas;
        if (!persona) continue;

        // 今日の日付を取得（設定のタイムゾーンで）
        const today = new Date().toLocaleDateString('en-CA', { 
          timeZone: randomCfg.timezone || 'UTC' 
        });
        
        // 日付が変わったかチェックし、必要に応じてposted_times_todayをリセット
        let postedTimesToday = randomCfg.posted_times_today || [];
        if (randomCfg.last_posted_date !== today) {
          postedTimesToday = [];
          // データベースも更新
          await supabase
            .from('random_post_configs')
            .update({ 
              last_posted_date: today,
              posted_times_today: []
            })
            .eq('id', randomCfg.id);
        }

        // 設定された各時間をチェック
        const randomTimes = randomCfg.random_times || ['09:00:00', '12:00:00', '18:00:00'];
        let hasPosted = false;

        for (const timeStr of randomTimes) {
          // 既に投稿済みの時間はスキップ
          if (postedTimesToday.includes(timeStr)) {
            continue;
          }

          // 現在時刻と設定時刻を比較
          const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
          const targetTime = new Date();
          
          // タイムゾーンを考慮して今日の設定時刻を作成
          if (randomCfg.timezone === 'UTC') {
            targetTime.setUTCHours(hours, minutes, seconds, 0);
          } else {
            // 指定タイムゾーンでの時刻を作成
            const formatter = new Intl.DateTimeFormat('en-CA', {
              timeZone: randomCfg.timezone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
            const todayStr = formatter.format(new Date());
            const localDateTime = new Date(`${todayStr}T${timeStr}`);
            const utcOffset = getTimezoneOffset(randomCfg.timezone);
            targetTime.setTime(localDateTime.getTime() - utcOffset * 60 * 1000);
          }

          // 現在時刻が設定時刻を過ぎているかチェック
          if (new Date() < targetTime) {
            continue;
          }

          console.log(`Processing random post for ${persona.name} at ${timeStr}`);

          // 該当ペルソナの完全オートポスト設定を取得（アクティブなもののみ）
          // 【緊急バグ修正】ランダムポスト処理で間違ったauto_post_configsを参照していた
          // ランダムポスト自身の設定を使用すべき - autoConfigsは不要
          console.log(`⚠️ Random post processing should use its own config, not auto_post_configs`);

          // ランダムポスト用のプロンプト生成（独自ロジック）
          const prompt = buildRandomPrompt(persona);
          const content = await generateWithGeminiRotation(prompt, persona.user_id);

          // postsへ作成（予約投稿）
          const { data: inserted, error: postErr } = await supabase
            .from('posts')
            .insert({
              user_id: persona.user_id,
              persona_id: persona.id,
              content,
              status: 'scheduled',
              scheduled_for: targetTime.toISOString(),
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
              scheduled_for: targetTime.toISOString(),
              queue_position: 0,
              status: 'queued'
            });
          if (queueErr) throw queueErr;

          // この時間を投稿済みとしてマーク
          postedTimesToday.push(timeStr);
          hasPosted = true;
          posted++;

          console.log(`Successfully processed random post for ${persona.name} at ${timeStr}`);
        }

        // 投稿があった場合、posted_times_todayを更新
        if (hasPosted) {
          await supabase
            .from('random_post_configs')
            .update({ 
              posted_times_today: postedTimesToday,
              last_posted_date: today
            })
            .eq('id', randomCfg.id);
        }

        if (hasPosted) processed++;
      } catch (e) {
        console.error('Random post generation failed:', e);
        failed++;
        processed++;
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
