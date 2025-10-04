-- Create template_random_post_configs table
CREATE TABLE IF NOT EXISTS public.template_random_post_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  random_times time[] NOT NULL DEFAULT '{}',
  templates text[] NOT NULL DEFAULT '{}',
  timezone text NOT NULL DEFAULT 'UTC',
  next_run_at timestamptz,
  posted_times_today jsonb DEFAULT '[]',
  last_posted_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.template_random_post_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own template random post configs"
  ON public.template_random_post_configs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own template random post configs"
  ON public.template_random_post_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own template random post configs"
  ON public.template_random_post_configs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own template random post configs"
  ON public.template_random_post_configs
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all template random post configs"
  ON public.template_random_post_configs
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Add index for performance
CREATE INDEX idx_template_random_post_configs_user_persona 
  ON public.template_random_post_configs(user_id, persona_id);

CREATE INDEX idx_template_random_post_configs_next_run 
  ON public.template_random_post_configs(next_run_at) 
  WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER update_template_random_post_configs_updated_at
  BEFORE UPDATE ON public.template_random_post_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();