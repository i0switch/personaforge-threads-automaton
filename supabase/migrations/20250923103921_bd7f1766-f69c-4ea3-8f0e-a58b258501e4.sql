-- 失敗投稿の自動再スケジュール機能

-- 失敗投稿を再スケジュールする関数
CREATE OR REPLACE FUNCTION reschedule_failed_posts_for_persona(p_persona_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rescheduled_count integer := 0;
  next_schedule_time timestamptz;
BEGIN
  -- 次のスケジュール時間を15分後に設定
  next_schedule_time := now() + INTERVAL '15 minutes';
  
  -- 該当ペルソナの失敗投稿を再スケジュール
  UPDATE posts 
  SET 
    status = 'scheduled',
    scheduled_for = next_schedule_time,
    retry_count = 0,
    last_retry_at = NULL,
    updated_at = now()
  WHERE persona_id = p_persona_id 
    AND status = 'failed'
    AND created_at > (now() - INTERVAL '7 days') -- 過去7日以内の投稿のみ
    AND published_at IS NULL;
  
  GET DIAGNOSTICS rescheduled_count = ROW_COUNT;
  
  -- 再スケジュールされた投稿をキューに追加
  IF rescheduled_count > 0 THEN
    INSERT INTO post_queue (user_id, post_id, scheduled_for, status, queue_position)
    SELECT 
      p.user_id,
      p.id,
      p.scheduled_for,
      'queued',
      ROW_NUMBER() OVER (ORDER BY p.scheduled_for)
    FROM posts p
    WHERE p.persona_id = p_persona_id 
      AND p.status = 'scheduled'
      AND p.scheduled_for = next_schedule_time
      AND p.id NOT IN (SELECT post_id FROM post_queue WHERE status IN ('queued', 'pending'));
    
    -- アクティビティログ記録
    INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
    SELECT 
      p.user_id, 
      p_persona_id, 
      'auto_reschedule_success',
      format('自動再スケジュール完了: %s件の失敗投稿を再設定', rescheduled_count),
      jsonb_build_object(
        'rescheduled_count', rescheduled_count,
        'next_schedule_time', next_schedule_time,
        'timestamp', now()
      )
    FROM personas p 
    WHERE p.id = p_persona_id
    LIMIT 1;
  END IF;
  
  RETURN rescheduled_count;
END;
$$;

-- ペルソナのトークン更新時に失敗投稿を自動再スケジュールするトリガー関数
CREATE OR REPLACE FUNCTION handle_persona_token_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rescheduled_count integer;
BEGIN
  -- トークンが新しく設定された場合のみ処理
  IF (OLD.threads_access_token IS NULL OR OLD.threads_access_token = '') 
     AND NEW.threads_access_token IS NOT NULL 
     AND NEW.threads_access_token != '' THEN
    
    -- 失敗投稿を自動再スケジュール
    SELECT reschedule_failed_posts_for_persona(NEW.id) INTO rescheduled_count;
    
    -- セキュリティログ記録
    INSERT INTO security_events (
      event_type, user_id, details
    ) VALUES (
      'token_configured_auto_reschedule',
      auth.uid(),
      jsonb_build_object(
        'persona_id', NEW.id,
        'persona_name', NEW.name,
        'rescheduled_posts', rescheduled_count,
        'timestamp', now()
      )
    );
    
    RAISE NOTICE '✅ ペルソナ % のトークン設定完了: %件の失敗投稿を自動再スケジュール', NEW.name, rescheduled_count;
  END IF;
  
  RETURN NEW;
END;
$$;

-- トリガーを作成（存在しない場合のみ）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_reschedule_on_token_update'
  ) THEN
    CREATE TRIGGER trigger_auto_reschedule_on_token_update
      AFTER UPDATE ON personas
      FOR EACH ROW
      EXECUTE FUNCTION handle_persona_token_update();
  END IF;
END $$;

-- 手動実行用の管理者関数
CREATE OR REPLACE FUNCTION admin_reschedule_all_failed_posts()
RETURNS TABLE(persona_name text, rescheduled_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  persona_rec record;
  count_result integer;
BEGIN
  -- 管理者権限確認
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- トークンが設定されているペルソナで失敗投稿があるものを処理
  FOR persona_rec IN 
    SELECT DISTINCT p.id, p.name
    FROM personas p
    JOIN posts po ON p.id = po.persona_id
    WHERE p.is_active = true
      AND p.threads_access_token IS NOT NULL
      AND p.threads_access_token != ''
      AND po.status = 'failed'
      AND po.created_at > (now() - INTERVAL '7 days')
  LOOP
    SELECT reschedule_failed_posts_for_persona(persona_rec.id) INTO count_result;
    
    persona_name := persona_rec.name;
    rescheduled_count := count_result;
    RETURN NEXT;
  END LOOP;
END;
$$;