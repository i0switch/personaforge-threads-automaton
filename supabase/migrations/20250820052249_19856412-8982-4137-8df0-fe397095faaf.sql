-- Fix search_path security warnings for newly added functions

-- 1. Fix calculate_next_multi_time_run function search_path
CREATE OR REPLACE FUNCTION public.calculate_next_multi_time_run(
  p_current_time timestamp with time zone, 
  time_slots time without time zone[], 
  timezone_name text DEFAULT 'UTC'::text
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  local_now timestamp;
  target_date date;
  next_slot time;
  next_run timestamptz;
  slot time;
  current_local_time time;
BEGIN
  -- Convert current time to specified timezone
  local_now := p_current_time AT TIME ZONE timezone_name;
  target_date := local_now::date;
  current_local_time := local_now::time;
  
  -- Find next available time slot today
  FOREACH slot IN ARRAY time_slots
  LOOP
    -- Add 1 minute buffer to ensure we don't schedule in the past
    IF slot > (current_local_time + INTERVAL '1 minute') THEN
      next_slot := slot;
      EXIT;
    END IF;
  END LOOP;
  
  -- If no slot found today, use first slot tomorrow
  IF next_slot IS NULL THEN
    next_slot := time_slots[1];
    target_date := target_date + INTERVAL '1 day';
  END IF;
  
  -- Construct next run time in the specified timezone
  next_run := (target_date::text || ' ' || next_slot::text)::timestamp AT TIME ZONE timezone_name;
  
  RETURN next_run;
END;
$$;

-- 2. Fix calculate_timezone_aware_next_run function search_path
CREATE OR REPLACE FUNCTION public.calculate_timezone_aware_next_run(
  current_schedule_time timestamp with time zone,
  timezone_name text DEFAULT 'UTC'::text
)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  local_current timestamp;
  next_run timestamptz;
BEGIN
  -- Convert to local timezone
  local_current := current_schedule_time AT TIME ZONE timezone_name;
  
  -- Add one day
  local_current := local_current + INTERVAL '1 day';
  
  -- Convert back to UTC with timezone
  next_run := local_current AT TIME ZONE timezone_name;
  
  RETURN next_run;
END;
$$;

-- 3. Fix check_posting_conflicts function search_path
CREATE OR REPLACE FUNCTION public.check_posting_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Check if persona has active random posting when enabling auto posting
  IF TG_TABLE_NAME = 'auto_post_configs' AND NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM random_post_configs 
      WHERE persona_id = NEW.persona_id 
      AND is_active = true
    ) THEN
      RAISE WARNING 'Persona % has active random posting. Auto posting may conflict.', NEW.persona_id;
    END IF;
  END IF;
  
  -- Check if persona has active auto posting when enabling random posting
  IF TG_TABLE_NAME = 'random_post_configs' AND NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM auto_post_configs 
      WHERE persona_id = NEW.persona_id 
      AND is_active = true
    ) THEN
      RAISE WARNING 'Persona % has active auto posting. Random posting may conflict.', NEW.persona_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;