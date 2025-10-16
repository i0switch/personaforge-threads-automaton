-- process-unhandled-repliesを5分ごとに実行するcronジョブを作成
SELECT cron.schedule(
  'process-unhandled-replies-cron',
  '*/5 * * * *', -- 5分ごとに実行
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/process-unhandled-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.WQJTEWyaLFUo4TBDCWwfJXJgOBmXVUoE_yNLFKP_k4g"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);