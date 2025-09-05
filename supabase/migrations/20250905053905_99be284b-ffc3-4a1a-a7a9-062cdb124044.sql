-- 1) ドラフト禁止トリガー関数を安全に改修（内部処理のみ例外）
CREATE OR REPLACE FUNCTION public.prevent_draft_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bypass text;
  bypass_on boolean := false;
BEGIN
  -- ローカルセッションGUCによる例外フラグ（edge functionや安全な内部処理のみで設定）
  bypass := current_setting('app.bypass_draft_check', true);
  IF bypass IS NOT NULL AND lower(bypass) IN ('on', 'true', '1') THEN
    bypass_on := true;
  END IF;

  -- draft投稿の禁止（例外: 内部クリーンアップで自動生成投稿のみ）
  IF NEW.status = 'draft' THEN
    IF NOT (bypass_on AND COALESCE(NEW.auto_schedule, false) = true) THEN
      RAISE EXCEPTION 'Draft posts are no longer allowed. All posts must be scheduled.';
    END IF;
  END IF;

  -- scheduledのときはscheduled_for必須
  IF NEW.status = 'scheduled' AND NEW.scheduled_for IS NULL THEN
    RAISE EXCEPTION 'Scheduled posts must have a scheduled_for timestamp.';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) トリガーを再作成（存在すれば削除してから作成）
DROP TRIGGER IF EXISTS trg_prevent_draft_posts ON public.posts;
CREATE TRIGGER trg_prevent_draft_posts
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_draft_posts();

-- 3) クリーンアップ関数にバイパスGUC設定を追加（ローカル・トランザクション内のみ有効）
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
$$;

CREATE OR REPLACE FUNCTION public.cleanup_auto_generated_schedules_only(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- アクティビティログ
  INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  SELECT 
    p.user_id, 
    p_persona_id, 
    'auto_schedule_cleanup',
    'Cleaned up auto-generated schedules only (manual reservations protected)',
    jsonb_build_object(
      'auto_posts_cleaned', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id 
        AND status = 'draft' 
        AND auto_schedule = true
      ),
      'manual_posts_protected', (
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

  -- 保護ログ記録
  INSERT INTO activity_logs (user_id, persona_id, action_type, description, metadata)
  SELECT 
    p.user_id, 
    p_persona_id, 
    'safe_cleanup',
    'Safe cleanup: manual reservations fully protected',
    jsonb_build_object(
      'auto_posts_affected', (
        SELECT COUNT(*) FROM posts 
        WHERE persona_id = p_persona_id 
        AND status = 'draft' 
        AND auto_schedule = true
      ),
      'manual_posts_protected', (
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
$$;