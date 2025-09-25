-- バグ修正: calculate_next_multi_time_run関数を改善し、20:00を追加
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

-- ギャル曽根の設定に20:00を追加
UPDATE auto_post_configs 
SET 
  post_times = array_append(post_times, '20:00:00'::time),
  next_run_at = '2025-09-25 20:00:00+09'::timestamptz,
  updated_at = now()
WHERE persona_id = (
  SELECT id FROM personas WHERE name = 'ギャル曽根' LIMIT 1
);

-- 問題解決ログ
INSERT INTO security_events (
  event_type,
  details
) VALUES (
  'schedule_bug_fixed',
  jsonb_build_object(
    'persona_name', 'ギャル曽根',
    'issue', 'No post times after 19:58, causing next_run to default to tomorrow',
    'solution', 'Added 20:00 to post_times array',
    'fixed_at', now()
  )
);