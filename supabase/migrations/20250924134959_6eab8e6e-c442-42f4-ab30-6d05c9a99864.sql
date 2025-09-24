-- cron jobでauto-post-generatorを5分ごとに実行
SELECT cron.schedule(
  'auto-post-generator',
  '*/5 * * * *', -- 5分ごと
  $$
  SELECT
    net.http_post(
        url:='https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.WQJTEWyaLFUo4TBDCWwfJXJgOBmXVUoE_yNLFKP_k4g"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- auto-schedulerも5分ごとに実行
SELECT cron.schedule(
  'auto-scheduler',
  '*/5 * * * *', -- 5分ごと
  $$
  SELECT
    net.http_post(
        url:='https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.WQJTEWyaLFUo4TBDCWwfJXJgOBmXVUoE_yNLFKP_k4g"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);

-- 残り3個の期限切れ設定も修正
UPDATE auto_post_configs 
SET next_run_at = now() + INTERVAL '10 minutes',
    updated_at = now()
WHERE is_active = true 
  AND next_run_at < now();

-- 監視用のセキュリティイベント追加
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'cron_job_emergency_setup',
  jsonb_build_object(
    'auto_post_generator_scheduled', true,
    'auto_scheduler_scheduled', true,
    'interval', '5 minutes',
    'timestamp', now()
  )
);