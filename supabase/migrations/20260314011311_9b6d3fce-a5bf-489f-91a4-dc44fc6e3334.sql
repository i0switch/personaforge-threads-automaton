ALTER TABLE public.auto_post_configs
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;