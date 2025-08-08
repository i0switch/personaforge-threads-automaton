-- Fix 1: Ensure unique settings per (user_id, persona_id)
-- Deduplicate any existing duplicates, keeping the most recently updated row
WITH ranked AS (
  SELECT 
    id, user_id, persona_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, persona_id 
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.self_reply_settings
)
DELETE FROM public.self_reply_settings s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- Create a unique index to support upsert on (user_id, persona_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_self_reply_settings_user_persona
ON public.self_reply_settings (user_id, persona_id);

-- Fix 2: Automatically enqueue self-reply jobs when a post is published
-- Attach trigger to posts table to call existing SECURITY DEFINER function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enqueue_self_reply_job'
  ) THEN
    CREATE TRIGGER trg_enqueue_self_reply_job
    AFTER UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_self_reply_job();
  END IF;
END $$;
