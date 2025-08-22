-- 過去の日時になっているnext_run_atを修正
UPDATE random_post_configs 
SET next_run_at = (
  CASE 
    WHEN random_times IS NOT NULL AND array_length(random_times, 1) > 0 THEN
      -- 今日の次の利用可能な時間、または翌日の最初の時間を計算
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM unnest(random_times) t 
          WHERE t::time > (now() AT TIME ZONE COALESCE(timezone, 'UTC'))::time
        ) THEN
          -- 今日の次の時間
          (CURRENT_DATE AT TIME ZONE COALESCE(timezone, 'UTC'))::timestamp + 
          (SELECT min(t) FROM unnest(random_times) t WHERE t::time > (now() AT TIME ZONE COALESCE(timezone, 'UTC'))::time)
        ELSE
          -- 翌日の最初の時間
          (CURRENT_DATE + INTERVAL '1 day' AT TIME ZONE COALESCE(timezone, 'UTC'))::timestamp + 
          random_times[1]
      END
    ELSE
      now() + INTERVAL '1 day'
  END
), updated_at = now()
WHERE is_active = true 
  AND next_run_at < now();