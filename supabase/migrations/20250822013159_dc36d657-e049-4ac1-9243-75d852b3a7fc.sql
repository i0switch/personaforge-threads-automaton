-- Cron jobが存在しない場合は作成
DO $$
BEGIN
  -- auto-post-generator用のcron jobを作成（5分間隔）
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-post-generator-job'
  ) THEN
    PERFORM cron.schedule(
      'auto-post-generator-job',
      '*/5 * * * *',
      $$SELECT net.http_post(
        url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_secret', true) || '"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$$
    );
  END IF;

  -- check-replies用のcron jobを作成（5分間隔）
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'check-replies-job'
  ) THEN
    PERFORM cron.schedule(
      'check-replies-job',
      '*/5 * * * *',
      $$SELECT net.http_post(
        url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/check-replies',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_secret', true) || '"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$$
    );
  END IF;
END
$$;