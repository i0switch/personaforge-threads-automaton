-- auto-post-generator用のcron jobを作成（5分間隔）
SELECT cron.schedule(
  'auto-post-generator-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-post-generator-job');

-- check-replies用のcron jobを作成（5分間隔）
SELECT cron.schedule(
  'check-replies-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-replies-job');