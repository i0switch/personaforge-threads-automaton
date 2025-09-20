-- 緊急修復: 非アクティブペルソナを直接修復
-- アクティブなオートポスト設定を持つが非アクティブなペルソナを修復

-- 1. 非アクティブペルソナをアクティブ化
UPDATE personas 
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT p.id 
  FROM personas p
  INNER JOIN auto_post_configs apc ON p.id = apc.persona_id
  WHERE p.is_active = false AND apc.is_active = true
);

-- 2. 期限切れのnext_run_atを修正
UPDATE auto_post_configs 
SET next_run_at = now() + INTERVAL '5 minutes',
    updated_at = now()
WHERE is_active = true 
  AND next_run_at < now() - INTERVAL '1 day';

-- 3. セキュリティログに記録
INSERT INTO security_events (event_type, details)
VALUES (
  'emergency_persona_fix',
  jsonb_build_object(
    'action', 'Direct database repair of inactive personas',
    'timestamp', now(),
    'reason', 'Edge function failing with 500 error'
  )
);