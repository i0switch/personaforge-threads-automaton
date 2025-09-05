-- 【緊急修正1】ランダムポスト設定の異常なnext_run_atを修正
UPDATE random_post_configs 
SET next_run_at = CASE
  WHEN timezone = 'Asia/Tokyo' THEN 
    (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Tokyo') + INTERVAL '1 day' + 
     (random_times[1 + floor(random() * array_length(random_times, 1))::int]::time))::timestamp AT TIME ZONE 'Asia/Tokyo'
  ELSE 
    (DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + 
     (random_times[1 + floor(random() * array_length(random_times, 1))::int]::time))::timestamp
END,
updated_at = NOW()
WHERE is_active = true AND next_run_at < NOW();

-- 【緊急修正2】同一ペルソナの重複auto_post_configsを統合（最新の1つだけ残す）
WITH duplicate_configs AS (
  SELECT persona_id, 
         array_agg(id ORDER BY created_at DESC) as config_ids,
         COUNT(*) as config_count
  FROM auto_post_configs 
  WHERE is_active = true
  GROUP BY persona_id 
  HAVING COUNT(*) > 1
)
UPDATE auto_post_configs 
SET is_active = false,
    updated_at = NOW()
FROM duplicate_configs dc
WHERE auto_post_configs.persona_id = dc.persona_id
  AND auto_post_configs.id != dc.config_ids[1];  -- 最新以外を非アクティブに

-- 【緊急修正3】集中した実行時刻を分散
UPDATE auto_post_configs 
SET next_run_at = next_run_at + (INTERVAL '5 minutes' * (RANDOM() * 60)::int),
    updated_at = NOW()
WHERE is_active = true 
  AND next_run_at = '2025-09-05 02:00:00+00';