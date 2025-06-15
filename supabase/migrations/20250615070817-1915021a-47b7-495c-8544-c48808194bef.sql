-- Add threads_access_token column to personas table
ALTER TABLE public.personas ADD COLUMN threads_access_token TEXT;