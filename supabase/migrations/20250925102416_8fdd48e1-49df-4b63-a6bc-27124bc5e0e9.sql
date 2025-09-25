-- 複数時間スケジューリング関数を修正して、連続投稿をサポート
CREATE OR REPLACE FUNCTION public.calculate_next_multi_time_run(
  p_current_time timestamp with time zone, 
  time_slots time without time zone[], 
  timezone_name text DEFAULT 'UTC'::text
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  local_now timestamp;
  target_date date;
  next_slot time;
  next_run timestamptz;
  slot time;
  current_local_time time;
  found_today boolean := false;
BEGIN
  -- Convert current time to specified timezone
  local_now := p_current_time AT TIME ZONE timezone_name;
  target_date := local_now::date;
  current_local_time := local_now::time;
  
  -- Find next available time slot today (with smaller buffer for sequential posting)
  FOREACH slot IN ARRAY time_slots
  LOOP
    -- Use smaller 30-second buffer to allow rapid sequential posting
    IF slot > (current_local_time + INTERVAL '30 seconds') THEN
      next_slot := slot;
      found_today := true;
      EXIT;
    END IF;
  END LOOP;
  
  -- If no slot found today, use first slot tomorrow
  IF NOT found_today THEN
    next_slot := time_slots[1];
    target_date := target_date + INTERVAL '1 day';
  END IF;
  
  -- Construct next run time in the specified timezone
  next_run := (target_date::text || ' ' || next_slot::text)::timestamp AT TIME ZONE timezone_name;
  
  RETURN next_run;
END;
$function$;

-- ギャル曽根のnext_run_atを手動で次の利用可能時間（明日の18:00）に設定
UPDATE auto_post_configs 
SET 
  next_run_at = calculate_next_multi_time_run(
    now(), 
    post_times,
    timezone
  ),
  updated_at = now()
WHERE persona_id = (
  SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1
);

-- 修正内容をログに記録
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'multi_time_fix_applied',
  jsonb_build_object(
    'persona_name', 'ギャル曽根',
    'action', 'fixed_sequential_posting_logic',
    'issue', 'Times 19:21 and 19:22 were being ignored',
    'fix', 'Reduced buffer time and improved next slot calculation',
    'timestamp', now()
  )
);