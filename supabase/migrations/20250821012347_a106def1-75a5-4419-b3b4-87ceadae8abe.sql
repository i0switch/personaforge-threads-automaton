-- ランダムポスト設定と完全オートポスト設定の排他制御トリガー
CREATE OR REPLACE FUNCTION handle_exclusive_posting_configs()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- トリガー作成
CREATE TRIGGER trigger_exclusive_random_post_config
  BEFORE UPDATE ON random_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION handle_exclusive_posting_configs();

CREATE TRIGGER trigger_exclusive_auto_post_config
  BEFORE UPDATE ON auto_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION handle_exclusive_posting_configs();