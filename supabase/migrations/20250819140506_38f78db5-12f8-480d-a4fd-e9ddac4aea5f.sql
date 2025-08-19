-- 重複したランダムポスト設定を削除（最初のものを残す）
DELETE FROM random_post_configs 
WHERE id IN ('daaa4199-dbfa-438a-bc53-27f20a0cfa95', '9bbdbdca-4181-4e5a-bdb1-3a392dbd1dbf');

-- 重複防止のためのユニーク制約を追加
ALTER TABLE random_post_configs 
ADD CONSTRAINT unique_user_persona_random_config 
UNIQUE (user_id, persona_id);