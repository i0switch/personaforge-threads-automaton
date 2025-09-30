-- Fix handle_exclusive_posting_configs trigger to only run when is_active changes from false to true
-- CRITICAL BUG FIX: The trigger was running on EVERY update when is_active=true,
-- causing all auto-generated posts to be reset to draft even during normal operations.

CREATE OR REPLACE FUNCTION public.handle_exclusive_posting_configs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- CRITICAL FIX: Only trigger cleanup when is_active CHANGES from false to true
  -- Not on every update when is_active is already true
  
  -- ランダムポスト設定がアクティブになる場合（false→trueのみ）
  IF TG_TABLE_NAME = 'random_post_configs' 
     AND NEW.is_active = true 
     AND (OLD.is_active IS NULL OR OLD.is_active = false) THEN
    -- 同じペルソナのオートポスト設定を非アクティブに
    UPDATE auto_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- 自動生成された投稿のみクリーンアップ（手動予約投稿は絶対保護）
    PERFORM cleanup_auto_generated_schedules_only(NEW.persona_id);
    
    -- 安全確認ログ
    RAISE NOTICE '[安全] ランダムポスト有効化: ペルソナ % - 手動予約投稿は完全保護', NEW.persona_id;
  END IF;
  
  -- オートポスト設定がアクティブになる場合（false→trueのみ）
  IF TG_TABLE_NAME = 'auto_post_configs' 
     AND NEW.is_active = true 
     AND (OLD.is_active IS NULL OR OLD.is_active = false) THEN
    -- 同じペルソナのランダムポスト設定を非アクティブに
    UPDATE random_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    -- 自動生成された投稿のみクリーンアップ（手動予約投稿は絶対保護）
    PERFORM cleanup_auto_generated_schedules_only(NEW.persona_id);
    
    -- 安全確認ログ
    RAISE NOTICE '[安全] オートポスト有効化: ペルソナ % - 手動予約投稿は完全保護', NEW.persona_id;
  END IF;
  
  RETURN NEW;
END;
$function$;