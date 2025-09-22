-- Fix missing profile and account status for existing user tomo5029@gmail.com
-- Also ensure triggers are working properly

-- Create missing profile for tomo5029@gmail.com
INSERT INTO public.profiles (user_id, display_name, created_at, updated_at)
VALUES (
  'b4de5c06-f0bc-4a05-91d3-eced9602c4db',
  'tomo5029@gmail.com',
  '2025-09-17 16:37:41+00',
  now()
) ON CONFLICT (user_id) DO NOTHING;

-- Create missing account status for tomo5029@gmail.com
INSERT INTO public.user_account_status (
  user_id, 
  is_active, 
  is_approved, 
  persona_limit,
  created_at,
  updated_at
)
VALUES (
  'b4de5c06-f0bc-4a05-91d3-eced9602c4db',
  true,  -- Active by default for existing user
  true,  -- Approved by default for existing user
  1,     -- Default persona limit
  '2025-09-17 16:37:41+00',
  now()
) ON CONFLICT (user_id) DO NOTHING;

-- Ensure the trigger function exists and is properly configured
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email));
  
  -- Create account status with default settings
  INSERT INTO public.user_account_status (
    user_id, 
    is_active, 
    is_approved, 
    persona_limit
  )
  VALUES (NEW.id, true, true, 1);
  
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

-- Recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();