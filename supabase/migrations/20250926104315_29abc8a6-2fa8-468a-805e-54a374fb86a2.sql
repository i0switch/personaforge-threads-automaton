-- スタックしたprocessingアイテムを手動でクリーンアップ
UPDATE post_queue 
SET status = 'failed', updated_at = NOW()
WHERE status = 'processing' 
AND updated_at < NOW() - INTERVAL '5 minutes';