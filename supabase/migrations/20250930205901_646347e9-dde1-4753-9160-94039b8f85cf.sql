-- Fix: New users should be unapproved by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  
  -- Create account status with unapproved default
  INSERT INTO public.user_account_status (
    user_id, 
    is_active, 
    is_approved, 
    persona_limit
  )
  VALUES (NEW.id, false, false, 1);
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    INSERT INTO security_events (
      event_type,
      user_id,
      details
    ) VALUES (
      'trigger_error',
      NEW.id,
      jsonb_build_object(
        'function', 'handle_new_user',
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    RETURN NEW;
END;
$$;