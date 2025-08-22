-- 前回無効化したauto_post_configsを再度有効化
UPDATE auto_post_configs 
SET is_active = true, updated_at = now()
WHERE persona_id IN (
  SELECT id FROM personas 
  WHERE threads_access_token IS NULL OR threads_access_token = ''
) 
AND is_active = false;