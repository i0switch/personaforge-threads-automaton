-- 緊急: システム全体の投稿を一時停止
UPDATE system_settings 
SET posting_paused = true,
    pause_reason = 'Emergency stop: Excessive posting detected',
    updated_at = now()
WHERE id = (SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1);