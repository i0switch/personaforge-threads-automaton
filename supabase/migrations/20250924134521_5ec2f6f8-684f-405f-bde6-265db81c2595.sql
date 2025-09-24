-- 緊急修復: 期限切れのオートポスト設定を今から1時間後にリセット
UPDATE auto_post_configs 
SET next_run_at = now() + INTERVAL '1 hour',
    updated_at = now()
WHERE is_active = true 
  AND next_run_at < now() - INTERVAL '1 day';

-- アクティビティログ記録
INSERT INTO activity_logs (user_id, action_type, description, metadata)
SELECT 
  user_id,
  'emergency_auto_post_reset',
  '期限切れオートポスト設定の緊急修復',
  jsonb_build_object(
    'reset_count', (
      SELECT COUNT(*) FROM auto_post_configs 
      WHERE is_active = true AND next_run_at < now() - INTERVAL '1 day'
    ),
    'timestamp', now()
  )
FROM auto_post_configs 
WHERE is_active = true AND next_run_at < now() - INTERVAL '1 day'
LIMIT 1;