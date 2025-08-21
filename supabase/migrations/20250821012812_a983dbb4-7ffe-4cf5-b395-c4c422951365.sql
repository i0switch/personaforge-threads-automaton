-- セキュリティ修正: search_pathを設定
CREATE OR REPLACE FUNCTION handle_exclusive_posting_configs()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- ランダムポスト設定がアクティブになる場合、同じペルソナの完全オートポスト設定を非アクティブに
  IF TG_TABLE_NAME = 'random_post_configs' AND NEW.is_active = true THEN
    UPDATE auto_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    RAISE NOTICE 'ランダムポスト設定がアクティブになったため、ペルソナ % の完全オートポスト設定を非アクティブにしました', NEW.persona_id;
  END IF;
  
  -- 完全オートポスト設定がアクティブになる場合、同じペルソナのランダムポスト設定を非アクティブに
  IF TG_TABLE_NAME = 'auto_post_configs' AND NEW.is_active = true THEN
    UPDATE random_post_configs 
    SET is_active = false, updated_at = now()
    WHERE persona_id = NEW.persona_id AND is_active = true;
    
    RAISE NOTICE '完全オートポスト設定がアクティブになったため、ペルソナ % のランダムポスト設定を非アクティブにしました', NEW.persona_id;
  END IF;
  
  RETURN NEW;
END;
$$;