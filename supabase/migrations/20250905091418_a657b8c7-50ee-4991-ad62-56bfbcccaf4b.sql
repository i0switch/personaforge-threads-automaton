-- クリーンアップ関数のアクティビティログ記録を削除
CREATE OR REPLACE FUNCTION public.cleanup_auto_generated_schedules_only(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned_count integer := 0;
  manual_count integer := 0;
BEGIN
  -- 内部処理用の一時バイパス（トランザクション内のみ）
  PERFORM set_config('app.bypass_draft_check', 'on', true);

  -- 自動生成された投稿のみを下書き状態にリセット
  UPDATE posts 
  SET status = 'draft',
      scheduled_for = NULL,
      retry_count = 0,
      last_retry_at = NULL,
      updated_at = now()
  WHERE persona_id = p_persona_id 
    AND status IN ('scheduled')
    AND published_at IS NULL
    AND auto_schedule = true;
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  -- キューからも自動生成された投稿のみ削除
  DELETE FROM post_queue 
  WHERE post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.persona_id = p_persona_id 
    AND p.auto_schedule = true
    AND p.status = 'draft'
  )
  AND status IN ('queued', 'pending');

  -- 手動予約投稿の数をカウント
  SELECT COUNT(*) INTO manual_count
  FROM posts 
  WHERE persona_id = p_persona_id 
    AND status = 'scheduled' 
    AND (auto_schedule IS NULL OR auto_schedule = false);

  -- アクティビティログ記録を削除（ユーザーが望まない情報のため）
  -- IF cleaned_count > 0 THEN
  --   INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  --   SELECT 
  --     p.user_id, 
  --     p_persona_id, 
  --     'auto_schedule_cleanup',
  --     'Cleaned up auto-generated schedules only (manual reservations protected)',
  --     jsonb_build_object(
  --       'auto_posts_cleaned', cleaned_count,
  --       'manual_posts_protected', manual_count,
  --       'timestamp', now()
  --     )
  --   FROM personas p 
  --   WHERE p.id = p_persona_id
  --   LIMIT 1;
  -- END IF;
END;
$$;

-- 他のクリーンアップ関数も同様にアクティビティログを削除
CREATE OR REPLACE FUNCTION public.cleanup_persona_schedules(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 内部処理用の一時バイパス（トランザクション内のみ）
  PERFORM set_config('app.bypass_draft_check', 'on', true);

  -- 自動生成されたスケジュール済み投稿のみを下書き状態にリセット
  UPDATE posts 
  SET status = 'draft',
      scheduled_for = NULL,
      retry_count = 0,
      last_retry_at = NULL,
      updated_at = now()
  WHERE persona_id = p_persona_id 
    AND status IN ('scheduled')
    AND published_at IS NULL
    AND auto_schedule = true;

  -- キューからも自動生成された投稿のみ削除
  DELETE FROM post_queue 
  WHERE post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.persona_id = p_persona_id 
    AND p.auto_schedule = true
  )
  AND status IN ('queued', 'pending');

  -- アクティビティログ記録を削除
  -- INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  -- SELECT 
  --   p.user_id, 
  --   p_persona_id, 
  --   'schedule_cleanup',
  --   'Cleaned up auto-generated schedules due to posting mode change',
  --   jsonb_build_object(
  --     'cleaned_auto_posts', (
  --       SELECT COUNT(*) FROM posts 
  --       WHERE persona_id = p_persona_id 
  --       AND status = 'draft' 
  --       AND auto_schedule = true
  --     ),
  --     'manual_posts_preserved', (
  --       SELECT COUNT(*) FROM posts 
  --       WHERE persona_id = p_persona_id 
  --       AND status = 'scheduled' 
  --       AND (auto_schedule IS NULL OR auto_schedule = false)
  --     ),
  --     'timestamp', now()
  --   )
  -- FROM personas p 
  -- WHERE p.id = p_persona_id
  -- LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_post_queue_for_persona(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 内部処理用の一時バイパス（トランザクション内のみ）
  PERFORM set_config('app.bypass_draft_check', 'on', true);

  -- 自動生成された投稿のキュー項目のみ削除
  DELETE FROM post_queue 
  WHERE post_id IN (
    SELECT p.id 
    FROM posts p 
    WHERE p.persona_id = p_persona_id 
    AND p.auto_schedule = true
    AND p.status IN ('scheduled', 'draft')
  )
  AND status IN ('queued', 'pending');
  
  -- 自動生成された投稿のみを下書きに
  UPDATE posts 
  SET status = 'draft', 
      scheduled_for = NULL,
      retry_count = 0,
      last_retry_at = NULL,
      updated_at = now()
  WHERE persona_id = p_persona_id 
  AND status = 'scheduled'
  AND published_at IS NULL
  AND auto_schedule = true;

  -- アクティビティログ記録を削除
  -- INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  -- SELECT 
  --   p.user_id, 
  --   p_persona_id, 
  --   'safe_cleanup',
  --   'Safe cleanup: manual reservations fully protected',
  --   jsonb_build_object(
  --     'auto_posts_affected', (
  --       SELECT COUNT(*) FROM posts 
  --       WHERE persona_id = p_persona_id 
  --       AND status = 'draft' 
  --       AND auto_schedule = true
  --     ),
  --     'manual_posts_protected', (
  --       SELECT COUNT(*) FROM posts 
  --       WHERE persona_id = p_persona_id 
  --       AND status = 'scheduled' 
  --       AND (auto_schedule IS NULL OR auto_schedule = false)
  --     ),
  --     'timestamp', now()
  --   )
  -- FROM personas p 
  -- WHERE p.id = p_persona_id
  -- LIMIT 1;
END;
$$;