-- 🚀 完全オートポストモード: cronジョブの正しい設定

-- 1. pg_cronとpg_net拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 既存のcronジョブを安全にクリア（存在する場合のみ）
DO $$
BEGIN
    PERFORM cron.unschedule('auto-scheduler-cron');
EXCEPTION WHEN OTHERS THEN
    NULL; -- エラーを無視
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('auto-post-generator-cron');
EXCEPTION WHEN OTHERS THEN
    NULL; -- エラーを無視
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule('reply-check-cron');
EXCEPTION WHEN OTHERS THEN
    NULL; -- エラーを無視
END $$;

-- 3. auto-scheduler cronジョブ（5分毎）
SELECT cron.schedule(
  'auto-scheduler-cron',
  '*/5 * * * *', -- 5分毎
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- 4. auto-post-generator cronジョブ（10分毎）
SELECT cron.schedule(
  'auto-post-generator-cron',
  '*/10 * * * *', -- 10分毎
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- 5. reply-check cronジョブ（15分毎）
SELECT cron.schedule(
  'reply-check-cron',
  '*/15 * * * *', -- 15分毎
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);