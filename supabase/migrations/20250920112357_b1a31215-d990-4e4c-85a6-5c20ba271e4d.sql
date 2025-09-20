-- セキュリティ修正: 関数の検索パス設定
CREATE OR REPLACE FUNCTION check_persona_limit_before_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  user_limit INTEGER;
BEGIN
  -- 現在のペルソナ数を取得
  SELECT COUNT(*) INTO current_count
  FROM personas 
  WHERE user_id = NEW.user_id;
  
  -- ユーザーの制限を取得
  SELECT persona_limit INTO user_limit
  FROM user_account_status 
  WHERE user_id = NEW.user_id;
  
  -- 制限チェック
  IF current_count >= COALESCE(user_limit, 1) THEN
    RAISE EXCEPTION 'Persona limit exceeded. Current: %, Limit: %', current_count, COALESCE(user_limit, 1);
  END IF;
  
  RETURN NEW;
END;
$$;