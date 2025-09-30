-- 下書き機能の完全廃止
-- すべての投稿は予約日時を持つ scheduled 状態のみ許可

-- 1. 既存のdraft投稿を削除（予約日時がないため投稿できない）
DELETE FROM posts WHERE status = 'draft';

-- 2. prevent_draft_posts トリガーと関数を削除
DROP TRIGGER IF EXISTS prevent_draft_posts_trigger ON posts;
DROP FUNCTION IF EXISTS prevent_draft_posts();

-- 3. validate_auto_schedule_post のトリガーを先に削除
DROP TRIGGER IF EXISTS validate_auto_schedule_posts_trigger ON posts;
DROP TRIGGER IF EXISTS validate_auto_schedule_post_trigger ON posts;

-- 4. その後関数を削除
DROP FUNCTION IF EXISTS validate_auto_schedule_post();

-- 5. posts.status のデフォルトを 'scheduled' に変更
ALTER TABLE posts ALTER COLUMN status SET DEFAULT 'scheduled';

-- 6. scheduled_for を必須に変更（scheduled状態の投稿は必ず予約日時を持つ）
ALTER TABLE posts ADD CONSTRAINT posts_scheduled_for_required 
  CHECK (
    (status = 'scheduled' AND scheduled_for IS NOT NULL) OR 
    (status IN ('published', 'failed', 'processing'))
  );

-- 確認ログ
DO $$
BEGIN
  RAISE NOTICE '✅ 下書き機能を完全廃止しました';
  RAISE NOTICE '✅ すべての投稿は scheduled 状態で予約日時必須です';
  RAISE NOTICE '✅ システムがシンプルになり、エラーが減ります';
END $$;