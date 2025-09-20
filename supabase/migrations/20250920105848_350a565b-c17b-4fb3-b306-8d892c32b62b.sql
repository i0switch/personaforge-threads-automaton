-- 軽微な設定矛盾の修正

-- 1. 非アクティブペルソナのアクティブ設定を無効化
UPDATE reply_check_settings 
SET is_active = false, updated_at = now()
WHERE persona_id IN (
  SELECT rcs.persona_id 
  FROM reply_check_settings rcs
  INNER JOIN personas p ON rcs.persona_id = p.id
  WHERE p.is_active = false AND rcs.is_active = true
);

UPDATE random_post_configs 
SET is_active = false, updated_at = now()
WHERE persona_id IN (
  SELECT rpc.persona_id 
  FROM random_post_configs rpc
  INNER JOIN personas p ON rpc.persona_id = p.id
  WHERE p.is_active = false AND rpc.is_active = true
);

-- 2. 孤立したプロフィール作成（user_account_statusがあるがprofilesがないユーザー）
INSERT INTO profiles (user_id, display_name, created_at, updated_at)
SELECT 
  uas.user_id,
  'User ' || SUBSTRING(CAST(uas.user_id AS TEXT), 1, 8) as display_name,
  now() as created_at,
  now() as updated_at
FROM user_account_status uas
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.user_id = uas.user_id
);

-- 3. セキュリティログに記録
INSERT INTO security_events (event_type, details)
VALUES (
  'minor_data_consistency_fix',
  jsonb_build_object(
    'action', 'Fixed inactive personas with active settings and missing profiles',
    'timestamp', now(),
    'reason', 'Proactive system maintenance'
  )
);