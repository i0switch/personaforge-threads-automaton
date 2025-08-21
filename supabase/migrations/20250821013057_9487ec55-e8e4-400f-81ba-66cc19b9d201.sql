-- 現在の重複状態を修正（ランダムポスト優先で完全オートポストを無効化）
UPDATE auto_post_configs 
SET is_active = false, updated_at = now()
WHERE persona_id IN (
  SELECT DISTINCT persona_id 
  FROM random_post_configs 
  WHERE is_active = true
) AND is_active = true;