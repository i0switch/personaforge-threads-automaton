-- Create self-reply feature tables and trigger without modifying existing features
-- 1) Settings table per persona
CREATE TABLE IF NOT EXISTS public.self_reply_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  persona_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  messages TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT self_reply_settings_unique UNIQUE (user_id, persona_id)
);

-- Enable RLS
ALTER TABLE public.self_reply_settings ENABLE ROW LEVEL SECURITY;

-- Policies: users manage their own settings
CREATE POLICY "Users can view their self-reply settings"
  ON public.self_reply_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their self-reply settings"
  ON public.self_reply_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their self-reply settings"
  ON public.self_reply_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their self-reply settings"
  ON public.self_reply_settings FOR DELETE
  USING (auth.uid() = user_id);

-- 2) Jobs table to process self-replies after publish
CREATE TABLE IF NOT EXISTS public.self_reply_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  persona_id UUID NOT NULL,
  post_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  threads_post_id TEXT, -- target Threads post to reply to (resolved later if null)
  reply_id TEXT, -- created reply id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for faster processing
CREATE INDEX IF NOT EXISTS idx_self_reply_jobs_status ON public.self_reply_jobs (status);
CREATE INDEX IF NOT EXISTS idx_self_reply_jobs_post ON public.self_reply_jobs (post_id);

-- Enable RLS
ALTER TABLE public.self_reply_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: service role manages; users can read their own job statuses
CREATE POLICY "Users can view their self-reply jobs"
  ON public.self_reply_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage self-reply jobs"
  ON public.self_reply_jobs FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- 3) Timestamp trigger function (generic)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to new tables
DROP TRIGGER IF EXISTS trg_self_reply_settings_updated_at ON public.self_reply_settings;
CREATE TRIGGER trg_self_reply_settings_updated_at
BEFORE UPDATE ON public.self_reply_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_self_reply_jobs_updated_at ON public.self_reply_jobs;
CREATE TRIGGER trg_self_reply_jobs_updated_at
BEFORE UPDATE ON public.self_reply_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Enqueue job automatically when a post is published
-- Trigger function to enqueue once per post
CREATE OR REPLACE FUNCTION public.enqueue_self_reply_job()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when newly published
  IF TG_OP = 'UPDATE' AND NEW.status = 'published' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Avoid duplicates
    IF NOT EXISTS (
      SELECT 1 FROM public.self_reply_jobs j WHERE j.post_id = NEW.id
    ) THEN
      INSERT INTO public.self_reply_jobs (user_id, persona_id, post_id, status)
      VALUES (NEW.user_id, NEW.persona_id, NEW.id, 'pending');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger on posts table
DROP TRIGGER IF EXISTS trg_enqueue_self_reply_on_publish ON public.posts;
CREATE TRIGGER trg_enqueue_self_reply_on_publish
AFTER UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_self_reply_job();