-- 重複cronジョブのクリーンアップ
SELECT cron.unschedule('auto-scheduler-job-secure');
SELECT cron.unschedule('invoke-auto-post-generator-every-minute');
SELECT cron.unschedule('auto-post-generator-job');

-- 残すのは最新の3つのみ
-- auto-scheduler-cron (5分毎)
-- auto-post-generator-cron (10分毎)  
-- reply-check-cron (15分毎)