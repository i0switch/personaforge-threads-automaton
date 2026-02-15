
-- 毎日1回 fetch-threads-user-ids を実行するcronジョブ
SELECT cron.schedule(
  'fetch-threads-user-ids-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/fetch-threads-user-ids',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
