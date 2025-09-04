-- セキュリティ警告の修正: Function Search Path を設定
-- prevent_draft_posts 関数に search_path を設定
CREATE OR REPLACE FUNCTION prevent_draft_posts()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- validate_auto_schedule_post 関数も search_path を設定
CREATE OR REPLACE FUNCTION validate_auto_schedule_post()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;