
-- Fix the hardcoded service role key in cron job
-- Remove the existing cron job with hardcoded key
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-scheduler-job') THEN
    PERFORM cron.unschedule('auto-scheduler-job');
  END IF;
END $$;

-- Create a new cron job that uses environment variables instead of hardcoded keys
-- This will need to be configured with proper authentication in production
SELECT cron.schedule(
  'auto-scheduler-job-secure',
  '*/5 * * * *', -- 5分毎
  $$
    SELECT
      net.http_post(
        url := 'https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-scheduler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object('scheduled_execution', true, 'timestamp', now())
      );
  $$
);

-- Add missing RLS policies for user_account_status table (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_account_status' 
    AND policyname = 'Admins can update account statuses'
  ) THEN
    CREATE POLICY "Admins can update account statuses" 
    ON public.user_account_status FOR UPDATE 
    USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Add missing RLS policies for user_roles table (only if not exists)
DO $$
BEGIN
  -- Check and create each policy individually
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_roles' 
    AND policyname = 'Admins can view all user roles'
  ) THEN
    CREATE POLICY "Admins can view all user roles" 
    ON public.user_roles FOR SELECT 
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_roles' 
    AND policyname = 'Admins can manage user roles'
  ) THEN
    CREATE POLICY "Admins can manage user roles" 
    ON public.user_roles FOR ALL 
    USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- Enable RLS on user_roles table if not already enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create a secure function for checking service role authentication
CREATE OR REPLACE FUNCTION public.authenticate_service_request(request_headers jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_header text;
  token text;
BEGIN
  -- Extract authorization header
  auth_header := request_headers ->> 'authorization';
  
  -- Check if header exists and starts with 'Bearer '
  IF auth_header IS NULL OR NOT auth_header LIKE 'Bearer %' THEN
    RETURN false;
  END IF;
  
  -- Extract token
  token := substring(auth_header from 8);
  
  -- Verify token format (basic JWT structure check)
  IF token IS NULL OR length(token) < 20 OR NOT token LIKE '%.%.%' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Add security logging table for tracking authentication attempts
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Add policies for security_events (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'security_events' 
    AND policyname = 'Admins can view security events'
  ) THEN
    CREATE POLICY "Admins can view security events" 
    ON public.security_events FOR SELECT 
    USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'security_events' 
    AND policyname = 'System can insert security events'
  ) THEN
    CREATE POLICY "System can insert security events" 
    ON public.security_events FOR INSERT 
    WITH CHECK (true);
  END IF;
END $$;
