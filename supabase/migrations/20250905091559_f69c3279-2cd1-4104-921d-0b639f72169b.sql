-- 投稿失敗のアクティビティログを削除するトリガーを作成
CREATE OR REPLACE FUNCTION public.filter_activity_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 特定のaction_typeまたはdescriptionのログをブロック
  IF NEW.action_type IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup') THEN
    -- ログを記録せずにNULLを返してINSERTをブロック
    RETURN NULL;
  END IF;
  
  -- 特定のdescriptionパターンをブロック
  IF NEW.description LIKE '%Failed to publish scheduled post%' 
     OR NEW.description LIKE '%Cleaned up auto-generated schedules%'
     OR NEW.description LIKE '%Cleaned up schedules due to posting mode change%' THEN
    RETURN NULL;
  END IF;
  
  -- 上記に該当しない場合は通常通り挿入
  RETURN NEW;
END;
$$;

-- activity_logsテーブルにINSERTトリガーを追加
DROP TRIGGER IF EXISTS filter_activity_logs_trigger ON activity_logs;
CREATE TRIGGER filter_activity_logs_trigger
  BEFORE INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION filter_activity_logs();

-- 既存の不要なアクティビティログを削除
DELETE FROM activity_logs 
WHERE action_type IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup')
   OR description LIKE '%Failed to publish scheduled post%'
   OR description LIKE '%Cleaned up auto-generated schedules%'
   OR description LIKE '%Cleaned up schedules due to posting mode change%';