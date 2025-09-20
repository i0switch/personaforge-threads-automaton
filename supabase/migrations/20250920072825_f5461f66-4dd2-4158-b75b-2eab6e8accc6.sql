-- cronジョブ状態確認用ビューの修正
DROP VIEW IF EXISTS cron_job_status;

CREATE VIEW cron_job_status AS
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname IN ('auto-scheduler-cron', 'auto-post-generator-cron', 'reply-check-cron');