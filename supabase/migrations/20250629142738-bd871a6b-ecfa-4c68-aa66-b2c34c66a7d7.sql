
-- pg_cronとpg_net拡張を有効にする
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 既存のcronジョブを安全に削除（存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-scheduler-job') THEN
    PERFORM cron.unschedule('auto-scheduler-job');
  END IF;
END $$;

-- 5分毎に自動スケジューラーを実行するcronジョブを作成
SELECT cron.schedule(
  'auto-scheduler-job',
  '*/5 * * * *', -- 5分毎
  $$
    SELECT
      net.http_post(
        url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.wruKKPGO3gTWu8GH8_O1TpEKNzWnHUkNKOmHH_GYBIQ'
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
