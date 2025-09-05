-- システム投稿一時停止を解除
UPDATE system_settings 
SET posting_paused = false,
    pause_reason = 'Manual restart after investigation',
    updated_at = now()
WHERE id = (SELECT id FROM system_settings ORDER BY updated_at DESC LIMIT 1);