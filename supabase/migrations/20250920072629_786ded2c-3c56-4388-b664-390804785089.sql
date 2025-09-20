-- 🚀 完全オートポストモード: cronジョブの設定と修復

-- 1. pg_cronとpg_net拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 既存のcronジョブをクリア
SELECT cron.unschedule('auto-scheduler-cron');
SELECT cron.unschedule('auto-post-generator-cron');  
SELECT cron.unschedule('reply-check-cron');

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

-- 6. 過去の日付で停止している next_run_at を修復（管理者権限で実行）
UPDATE auto_post_configs 
SET next_run_at = now() + INTERVAL '2 minutes'
WHERE is_active = true 
AND next_run_at < now() - INTERVAL '1 hour';

-- 7. cronジョブ状態確認用ビューを作成
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname IN ('auto-scheduler-cron', 'auto-post-generator-cron', 'reply-check-cron');