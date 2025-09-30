-- 下書き機能の完全廃止（既存制約を考慮）

-- 1. 既存のdraft投稿を削除
DELETE FROM posts WHERE status = 'draft';

-- 2. prevent_draft_posts トリガーを削除
DROP TRIGGER IF EXISTS prevent_draft_posts_trigger ON posts;
DROP FUNCTION IF EXISTS prevent_draft_posts();

-- 3. validate_auto_schedule_post トリガーを削除
DROP TRIGGER IF EXISTS validate_auto_schedule_post_trigger ON posts;
DROP FUNCTION IF EXISTS validate_auto_schedule_post();

-- 4. 既存の制約を削除してから再作成
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_scheduled_for_required;
ALTER TABLE posts ADD CONSTRAINT posts_scheduled_for_required 
  CHECK (
    (status = 'scheduled' AND scheduled_for IS NOT NULL) OR 
    (status IN ('published', 'failed', 'processing'))
  );

-- 5. posts.status のデフォルトを 'scheduled' に変更
ALTER TABLE posts ALTER COLUMN status SET DEFAULT 'scheduled';

-- 確認ログ
DO $$
BEGIN
  RAISE NOTICE '✅ 下書き機能を完全廃止';
  RAISE NOTICE '✅ scheduled 状態の投稿は scheduled_for 必須';
END $$;