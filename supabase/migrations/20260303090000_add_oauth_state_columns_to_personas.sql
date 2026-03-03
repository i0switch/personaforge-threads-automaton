ALTER TABLE public.personas
ADD COLUMN IF NOT EXISTS oauth_state text;

ALTER TABLE public.personas
ADD COLUMN IF NOT EXISTS oauth_state_expires_at timestamp with time zone;

ALTER TABLE public.personas
ADD COLUMN IF NOT EXISTS oauth_redirect_uri text;

CREATE INDEX IF NOT EXISTS idx_personas_oauth_state
ON public.personas (oauth_state)
WHERE oauth_state IS NOT NULL;
