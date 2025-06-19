-- Add auto_reply_enabled field to profiles table for global auto-reply control
ALTER TABLE public.profiles 
ADD COLUMN auto_reply_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.auto_reply_enabled IS 'Global setting to enable/disable AI auto-reply functionality for this user';