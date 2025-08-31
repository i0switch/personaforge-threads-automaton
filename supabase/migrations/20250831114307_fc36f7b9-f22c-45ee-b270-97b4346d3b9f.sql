-- 予約投稿機能を独立させるため、cleanup_persona_schedules関数を修正
-- 手動予約投稿（auto_schedule != true）は清掃対象から除外する

CREATE OR REPLACE FUNCTION public.cleanup_persona_schedules(p_persona_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 自動生成されたスケジュール済み投稿のみを下書き状態にリセット
  -- 手動予約投稿（auto_schedule != true）は除外
  UPDATE posts 
  SET status = 'draft',
      scheduled_for = NULL,
      retry_count = 0,
      last_retry_at = NULL,
      updated_at = now()
  WHERE persona_id = p_persona_id 
    AND status IN ('scheduled')
    AND published_at IS NULL
    AND auto_schedule = true;  -- 自動生成された投稿のみ対象

  -- キューからも自動生成された投稿のみ削除
  DELETE FROM post_queue 
  WHERE post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.persona_id = p_persona_id 
    AND p.auto_schedule = true  -- 自動生成された投稿のみ
  )
  AND status IN ('queued', 'pending');

  -- アクティブログに記録
  INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  SELECT 
    p.user_id, 
    p_persona_id, 
    'schedule_cleanup',
    'Cleaned up auto-generated schedules due to posting mode change',
    jsonb_build_object(
      'cleaned_auto_posts', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id 
        AND status = 'draft' 
        AND scheduled_for IS NULL 
        AND auto_schedule = true
      ),
      'manual_posts_preserved', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id 
        AND status = 'scheduled' 
        AND (auto_schedule IS NULL OR auto_schedule = false)
      ),
      'timestamp', now()
    )
  FROM personas p 
  WHERE p.id = p_persona_id
  LIMIT 1;
END;
$function$;