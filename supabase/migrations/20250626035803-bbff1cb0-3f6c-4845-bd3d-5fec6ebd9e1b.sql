
-- Add threads_username column to personas table
ALTER TABLE public.personas 
ADD COLUMN threads_username text;

-- Add comment for clarity
COMMENT ON COLUMN public.personas.threads_username IS 'Threads username to avoid self-replies (e.g., @username)';
