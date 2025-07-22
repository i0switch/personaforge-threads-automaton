-- Add missing threads_user_id column to personas table
ALTER TABLE public.personas 
ADD COLUMN IF NOT EXISTS threads_user_id TEXT;