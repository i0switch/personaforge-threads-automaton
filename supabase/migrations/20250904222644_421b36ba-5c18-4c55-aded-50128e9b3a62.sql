-- 自動生成投稿の場合はデフォルトステータスを'scheduled'にする
-- postsテーブルのデフォルト値を変更せず、auto_schedule=trueの場合のみ対応
-- これにより手動投稿（auto_schedule=false or null）は従来通り'draft'で保存される

-- 投稿作成時にauto_scheduleがtrueの場合、適切な検証を行うトリガーを作成
CREATE OR REPLACE FUNCTION validate_auto_schedule_post()
RETURNS TRIGGER AS $$
BEGIN
  -- 自動スケジュール投稿の場合
  IF NEW.auto_schedule = true THEN
    -- scheduled_forが設定されていない場合はエラー
    IF NEW.scheduled_for IS NULL THEN
      RAISE EXCEPTION 'Auto-scheduled posts must have scheduled_for timestamp';
    END IF;
    
    -- statusがscheduledでない場合はエラー
    IF NEW.status != 'scheduled' THEN
      RAISE EXCEPTION 'Auto-scheduled posts must have status = scheduled, got: %', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成（INSERT時のみ - UPDATE時は既存ロジックを保持）
CREATE TRIGGER validate_auto_schedule_posts_trigger
  BEFORE INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION validate_auto_schedule_post();