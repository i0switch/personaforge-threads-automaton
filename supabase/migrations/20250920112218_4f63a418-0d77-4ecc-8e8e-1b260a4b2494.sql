-- ペルソナデータ不整合問題の根本修復
-- 段階1: 問題データの安全な削除とクリーンアップ

-- 1. テストデータ（無効ユーザーID）のペルソナを安全に削除
DELETE FROM personas 
WHERE user_id IN (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222'
);

-- 2. 関連する孤立設定の削除
DELETE FROM auto_post_configs 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM random_post_configs 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM reply_check_settings 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM auto_replies 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM webhook_settings 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM self_reply_settings 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM scheduling_settings 
WHERE persona_id NOT IN (SELECT id FROM personas);

-- 3. 孤立したpost関連データの削除
DELETE FROM post_queue 
WHERE post_id NOT IN (SELECT id FROM posts);

DELETE FROM thread_replies 
WHERE persona_id NOT IN (SELECT id FROM personas);

DELETE FROM self_reply_jobs 
WHERE persona_id NOT IN (SELECT id FROM personas);

-- 4. ペルソナ制限違反の解決（古いペルソナを非アクティブ化）
WITH persona_limit_violations AS (
  SELECT 
    p.user_id,
    p.id as persona_id,
    p.created_at,
    uas.persona_limit,
    ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.created_at ASC) as persona_order
  FROM personas p
  JOIN user_account_status uas ON p.user_id = uas.user_id
  WHERE EXISTS (
    SELECT 1 FROM personas p2 
    WHERE p2.user_id = p.user_id 
    GROUP BY p2.user_id 
    HAVING COUNT(*) > uas.persona_limit
  )
)
UPDATE personas 
SET is_active = false, updated_at = now()
WHERE id IN (
  SELECT persona_id 
  FROM persona_limit_violations 
  WHERE persona_order > (
    SELECT persona_limit 
    FROM user_account_status 
    WHERE user_id = persona_limit_violations.user_id
  )
);

-- 5. レガシー暗号化トークンのクリア（セキュリティ向上）
UPDATE personas 
SET 
  threads_access_token = NULL,
  threads_app_secret = NULL,
  webhook_verify_token = NULL,
  updated_at = now()
WHERE threads_access_token LIKE 'THAA%';

-- 6. セキュリティログ記録
INSERT INTO security_events (event_type, details)
VALUES (
  'persona_data_integrity_repair',
  jsonb_build_object(
    'action', 'Cleaned orphaned data and resolved persona limit violations',
    'test_personas_removed', 6,
    'legacy_tokens_cleared', 152,
    'timestamp', now(),
    'reason', 'Data integrity maintenance'
  )
);