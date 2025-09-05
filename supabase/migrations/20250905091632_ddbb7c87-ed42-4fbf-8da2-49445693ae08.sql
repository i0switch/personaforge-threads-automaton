-- post_publish_failed のアクティビティログを非表示にする設定を追加
-- アクティビティログ取得時に特定のaction_typeを除外するビューを作成
CREATE OR REPLACE VIEW public.filtered_activity_logs AS
SELECT 
  id,
  user_id,
  persona_id,
  action_type,
  description,
  metadata,
  created_at
FROM public.activity_logs
WHERE action_type NOT IN ('post_publish_failed', 'auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup');

-- 既存のpost_publish_failedログを削除（オプション）
-- DELETE FROM activity_logs WHERE action_type = 'post_publish_failed';

-- クリーンアップ関連のログも削除（オプション）  
-- DELETE FROM activity_logs WHERE action_type IN ('auto_schedule_cleanup', 'schedule_cleanup', 'safe_cleanup');