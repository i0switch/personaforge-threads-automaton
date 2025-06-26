
-- Add reply_mode column to personas table to specify the auto-reply method for each persona
ALTER TABLE public.personas 
ADD COLUMN reply_mode text DEFAULT 'disabled' CHECK (reply_mode IN ('disabled', 'keyword', 'ai'));

-- Add comment for clarity
COMMENT ON COLUMN public.personas.reply_mode IS 'Auto-reply mode for this persona: disabled, keyword, or ai';
