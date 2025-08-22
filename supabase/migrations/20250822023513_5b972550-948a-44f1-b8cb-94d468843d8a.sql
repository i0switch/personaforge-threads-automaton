-- 過去の日時になっているnext_run_atを修正（簡単版）
UPDATE random_post_configs 
SET next_run_at = now() + INTERVAL '1 hour',
    updated_at = now()
WHERE is_active = true 
  AND next_run_at < now();