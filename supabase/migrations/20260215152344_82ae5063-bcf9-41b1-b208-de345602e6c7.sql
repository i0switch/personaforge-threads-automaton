
-- 毎日1回 fetch-threads-user-ids を実行するcronジョブ
SELECT cron.schedule(
  'fetch-threads-user-ids-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/fetch-threads-user-ids',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.anon_key', true), current_setting('app.anon_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
