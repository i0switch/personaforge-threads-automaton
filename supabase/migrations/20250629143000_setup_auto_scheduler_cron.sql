
-- pg_cronとpg_net拡張を有効にする
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 既存のcronジョブを削除（もしあれば）
SELECT cron.unschedule('auto-scheduler-job');

-- 5分毎に自動スケジューラーを実行するcronジョブを作成
SELECT cron.schedule(
  'auto-scheduler-job',
  '*/5 * * * *', -- 5分毎
  $$
    SELECT
      net.http_post(
        url := 'https://' || current_setting('app.settings.supabase_url') || '/functions/v1/auto-scheduler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('scheduled_execution', true, 'timestamp', now())
      );
  $$
);

-- cronジョブの状態を確認するためのビューを作成
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  jobname,
  schedule,
  active,
  jobid
FROM cron.job 
WHERE jobname = 'auto-scheduler-job';
