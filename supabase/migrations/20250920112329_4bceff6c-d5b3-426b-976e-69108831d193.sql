-- 段階2: 外部キー制約とカスケード削除の実装
-- 根本原因解決: 今後の孤立データ発生を防止

-- 1. personas テーブルへの外部キー制約追加（カスケード削除）
-- ただし、既存データを保護するため、既存の有効データのみ残す
ALTER TABLE personas 
ADD CONSTRAINT fk_personas_user_id 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. 関連テーブルにもカスケード制約追加
ALTER TABLE auto_post_configs 
ADD CONSTRAINT fk_auto_post_configs_user_id 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE auto_post_configs 
ADD CONSTRAINT fk_auto_post_configs_persona_id 
FOREIGN KEY (persona_id) 
REFERENCES personas(id) 
ON DELETE CASCADE;

ALTER TABLE random_post_configs 
ADD CONSTRAINT fk_random_post_configs_user_id 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE random_post_configs 
ADD CONSTRAINT fk_random_post_configs_persona_id 
FOREIGN KEY (persona_id) 
REFERENCES personas(id) 
ON DELETE CASCADE;

ALTER TABLE posts 
ADD CONSTRAINT fk_posts_user_id 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE posts 
ADD CONSTRAINT fk_posts_persona_id 
FOREIGN KEY (persona_id) 
REFERENCES personas(id) 
ON DELETE CASCADE;

ALTER TABLE reply_check_settings 
ADD CONSTRAINT fk_reply_check_settings_user_id 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

ALTER TABLE reply_check_settings 
ADD CONSTRAINT fk_reply_check_settings_persona_id 
FOREIGN KEY (persona_id) 
REFERENCES personas(id) 
ON DELETE CASCADE;

-- 3. ペルソナ制限チェック強化トリガー
CREATE OR REPLACE FUNCTION check_persona_limit_before_insert()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- トリガー適用
DROP TRIGGER IF EXISTS trigger_check_persona_limit ON personas;
CREATE TRIGGER trigger_check_persona_limit
  BEFORE INSERT ON personas
  FOR EACH ROW
  EXECUTE FUNCTION check_persona_limit_before_insert();

-- 4. セキュリティログ記録
INSERT INTO security_events (event_type, details)
VALUES (
  'foreign_key_constraints_implemented',
  jsonb_build_object(
    'action', 'Added foreign key constraints with CASCADE delete',
    'tables_affected', ARRAY['personas', 'auto_post_configs', 'random_post_configs', 'posts', 'reply_check_settings'],
    'persona_limit_trigger', 'enabled',
    'timestamp', now(),
    'reason', 'Prevent future data integrity issues'
  )
);