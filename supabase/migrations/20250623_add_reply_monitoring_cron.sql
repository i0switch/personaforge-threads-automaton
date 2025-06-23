
-- pg_cronとpg_netエクステンションを有効化（まだの場合）
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 5分ごとにリプライをチェックするCron jobを作成
SELECT cron.schedule(
  'check-replies-every-5-minutes',
  '*/5 * * * *', -- 5分ごと
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);
