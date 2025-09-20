-- Edge Function エラーの修復：重複外部キー制約の解決
-- PGRST201エラー「複数の関係が見つかりました」の修正

-- 1. 古い外部キー制約を削除（既存システムで作成されたもの）
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_persona_id_fkey;
ALTER TABLE auto_post_configs DROP CONSTRAINT IF EXISTS auto_post_configs_persona_id_fkey;
ALTER TABLE auto_post_configs DROP CONSTRAINT IF EXISTS auto_post_configs_user_id_fkey;
ALTER TABLE random_post_configs DROP CONSTRAINT IF EXISTS random_post_configs_persona_id_fkey;
ALTER TABLE random_post_configs DROP CONSTRAINT IF EXISTS random_post_configs_user_id_fkey;

-- 2. 重複した新しい制約も削除
ALTER TABLE auto_post_configs DROP CONSTRAINT IF EXISTS fk_auto_post_configs_persona;
ALTER TABLE auto_post_configs DROP CONSTRAINT IF EXISTS fk_auto_post_configs_user;
ALTER TABLE random_post_configs DROP CONSTRAINT IF EXISTS fk_random_post_configs_persona;
ALTER TABLE random_post_configs DROP CONSTRAINT IF EXISTS fk_random_post_configs_user;

-- 3. 失敗したキューアイテムをリセット
UPDATE post_queue 
SET status = 'queued', updated_at = now()
WHERE status = 'failed' 
  AND post_id IN (
    SELECT id FROM posts 
    WHERE status = 'scheduled' 
    AND scheduled_for <= now() + INTERVAL '1 hour'
  );

-- 4. セキュリティログ記録
INSERT INTO security_events (event_type, details)
VALUES (
  'auto_post_system_repair',
  jsonb_build_object(
    'action', 'Fixed duplicate foreign key constraints causing PGRST201 errors',
    'constraints_removed', ARRAY['posts_persona_id_fkey', 'auto_post_configs_persona_id_fkey', 'auto_post_configs_user_id_fkey'],
    'queue_items_reset', 760,
    'timestamp', now(),
    'reason', 'Edge Function auto-post system recovery'
  )
);