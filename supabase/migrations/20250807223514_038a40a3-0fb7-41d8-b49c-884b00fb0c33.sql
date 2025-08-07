-- Create table for auto post configurations
CREATE TABLE IF NOT EXISTS public.auto_post_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  persona_id UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  prompt_template TEXT,
  content_prefs TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  post_time TIME NOT NULL,
  next_run_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.auto_post_configs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  CREATE POLICY "Users can select their auto post configs"
  ON public.auto_post_configs
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their auto post configs"
  ON public.auto_post_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their auto post configs"
  ON public.auto_post_configs
  FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their auto post configs"
  ON public.auto_post_configs
  FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_auto_post_configs_updated_at
  BEFORE UPDATE ON public.auto_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_post_configs_user_id ON public.auto_post_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_post_configs_next_run_at ON public.auto_post_configs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_auto_post_configs_active ON public.auto_post_configs(is_active);

-- Cron job to invoke auto-post-generator every minute
select
cron.schedule(
  'invoke-auto-post-generator-every-minute',
  '* * * * *',
  $$
  select
    net.http_post(
        url:='https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/auto-post-generator',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
