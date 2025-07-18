-- Create cron job for processing scheduled replies every 5 minutes
SELECT cron.schedule(
  'process-scheduled-replies',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/process-scheduled-replies',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MTUxODEsImV4cCI6MjA2NTQ5MTE4MX0.5_mXobtncEbIHyigC_EqP-z1cr7AWYepR7L2CZwjBvI"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);