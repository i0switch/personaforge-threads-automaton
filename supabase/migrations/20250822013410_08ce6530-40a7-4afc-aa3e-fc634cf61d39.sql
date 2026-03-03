-- auto-post-generator用のcron jobを作成（5分間隔）
SELECT cron.schedule(
  'auto-post-generator-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.anon_key', true), current_setting('app.anon_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
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
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.anon_key', true), current_setting('app.anon_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
) WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-replies-job');