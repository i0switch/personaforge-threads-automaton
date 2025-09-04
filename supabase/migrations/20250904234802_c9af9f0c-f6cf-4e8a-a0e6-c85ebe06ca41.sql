-- 既存の下書き投稿をすべて予約投稿に変換
-- 下書き投稿で scheduled_for が NULL の場合、現在時刻から1時間後に設定
UPDATE posts 
SET 
  status = 'scheduled',
  scheduled_for = COALESCE(
    scheduled_for, 
    now() + INTERVAL '1 hour'
  )
WHERE status = 'draft';

-- 今後下書き投稿が作成されることを防ぐ検証関数を強化
CREATE OR REPLACE FUNCTION prevent_draft_posts()
RETURNS TRIGGER AS $$
BEGIN
  -- draft ステータスでの投稿作成を禁止
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Draft posts are no longer allowed. All posts must be scheduled.';
  END IF;
  
  -- scheduled ステータスの場合、scheduled_for は必須
  IF NEW.status = 'scheduled' AND NEW.scheduled_for IS NULL THEN
    RAISE EXCEPTION 'Scheduled posts must have a scheduled_for timestamp.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成（INSERT と UPDATE 両方に適用）
DROP TRIGGER IF EXISTS prevent_draft_posts_trigger ON posts;
CREATE TRIGGER prevent_draft_posts_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_draft_posts();