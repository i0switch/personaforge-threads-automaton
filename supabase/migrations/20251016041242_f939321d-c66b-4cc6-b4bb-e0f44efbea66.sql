-- process-unhandled-repliesを5分ごとに実行するcronジョブを作成
SELECT cron.schedule(
  'process-unhandled-replies-cron',
  '*/5 * * * *', -- 5分ごとに実行
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/process-unhandled-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.service_role_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);