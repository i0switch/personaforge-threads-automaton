-- 予約投稿機能の完全独立化：排他制御トリガーを修正
-- 手動予約投稿（auto_schedule != true）は他の機能の影響を受けないようにする

DROP TRIGGER IF EXISTS exclusive_posting_configs_trigger ON auto_post_configs;
DROP TRIGGER IF EXISTS exclusive_posting_configs_trigger ON random_post_configs;

-- 改良された排他制御関数：手動予約投稿は保護
CREATE OR REPLACE FUNCTION public.handle_exclusive_posting_configs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- ランダムポスト設定がアクティブになる場合
  IF TG_TABLE_NAME = 'random_post_configs' AND NEW.is_active = true THEN
    -- 同じペルソナのオートポスト設定を非アクティブに
    UPDATE auto_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- 自動生成された投稿のみクリーンアップ（手動予約投稿は保護）
    PERFORM cleanup_auto_generated_schedules_only(NEW.persona_id);
    
    RAISE NOTICE 'ランダムポスト設定アクティブ化: ペルソナ % のオートポスト設定を非アクティブにし、自動生成スケジュールのみ清掃しました', NEW.persona_id;
  END IF;
  
  -- オートポスト設定がアクティブになる場合
  IF TG_TABLE_NAME = 'auto_post_configs' AND NEW.is_active = true THEN
    -- 同じペルソナのランダムポスト設定を非アクティブに
    UPDATE random_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- 自動生成された投稿のみクリーンアップ（手動予約投稿は保護）
    PERFORM cleanup_auto_generated_schedules_only(NEW.persona_id);
    
    RAISE NOTICE 'オートポスト設定アクティブ化: ペルソナ % のランダムポスト設定を非アクティブにし、自動生成スケジュールのみ清掃しました', NEW.persona_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 手動予約投稿を保護する新しいクリーンアップ関数
CREATE OR REPLACE FUNCTION public.cleanup_auto_generated_schedules_only(p_persona_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 自動生成された投稿のみを下書き状態にリセット
  -- 手動予約投稿（auto_schedule != true または auto_schedule IS NULL）は絶対に触らない
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
    AND p.status = 'draft'  -- 上で下書きに変更された投稿
  )
  AND status IN ('queued', 'pending');

  -- アクティビティログに記録
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
$function$;

-- 排他制御トリガーを再作成
CREATE TRIGGER exclusive_posting_configs_trigger
  BEFORE INSERT OR UPDATE ON auto_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION handle_exclusive_posting_configs();

CREATE TRIGGER exclusive_posting_configs_trigger
  BEFORE INSERT OR UPDATE ON random_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION handle_exclusive_posting_configs();