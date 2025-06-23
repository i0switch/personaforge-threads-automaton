
-- Add ai_auto_reply_enabled field to profiles table for AI auto-reply control
ALTER TABLE public.profiles 
ADD COLUMN ai_auto_reply_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.ai_auto_reply_enabled IS 'Global setting to enable/disable AI auto-reply functionality for this user';
