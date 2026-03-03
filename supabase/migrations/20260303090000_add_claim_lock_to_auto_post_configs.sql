-- Add claim/processing state to auto_post_configs for race-condition prevention
ALTER TABLE public.auto_post_configs
  ADD COLUMN IF NOT EXISTS processing_status TEXT,
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

UPDATE public.auto_post_configs
SET processing_status = 'idle'
WHERE processing_status IS NULL;

ALTER TABLE public.auto_post_configs
  ALTER COLUMN processing_status SET DEFAULT 'idle',
  ALTER COLUMN processing_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auto_post_configs_processing_status_check'
      AND conrelid = 'public.auto_post_configs'::regclass
  ) THEN
    ALTER TABLE public.auto_post_configs
      ADD CONSTRAINT auto_post_configs_processing_status_check
      CHECK (processing_status IN ('idle', 'claimed', 'processing'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auto_post_configs_claim_lookup
  ON public.auto_post_configs (is_active, next_run_at, processing_status, claim_expires_at);
