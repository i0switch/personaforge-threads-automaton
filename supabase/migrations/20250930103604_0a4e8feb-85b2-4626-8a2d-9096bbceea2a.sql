-- 正しいジョブ名でcronを1分間隔に変更

-- auto-post-generator (jobid:18)を1分間隔に
SELECT cron.unschedule(18);
SELECT cron.schedule(
  'auto-post-generator',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.service_role_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- auto-scheduler (jobid:19)を1分間隔に
SELECT cron.unschedule(19);
SELECT cron.schedule(
  'auto-scheduler',
  '* * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), current_setting('app.service_role_key', true), current_setting('app.jwt_secret', true), current_setting('app.settings.jwt_secret', true)) || '"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);