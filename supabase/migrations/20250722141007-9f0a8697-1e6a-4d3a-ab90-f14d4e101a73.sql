-- 5分ごとにリプライをチェックするCron jobを作成
SELECT cron.schedule(
  'check-replies-every-5-minutes',
  '*/5 * * * *', -- 5分ごと
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.anon_key', true), current_setting('app.anon_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);