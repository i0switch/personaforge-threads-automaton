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
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.WQJTEWyaLFUo4TBDCWwfJXJgOBmXVUoE_yNLFKP_k4g"}'::jsonb,
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
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.WQJTEWyaLFUo4TBDCWwfJXJgOBmXVUoE_yNLFKP_k4g"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);