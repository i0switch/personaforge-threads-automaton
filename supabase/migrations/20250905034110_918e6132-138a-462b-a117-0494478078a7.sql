-- Global posting pause and safety controls
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_paused BOOLEAN NOT NULL DEFAULT false,
  pause_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage system settings
CREATE POLICY IF NOT EXISTS "Admins can view system settings"
ON public.system_settings
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins can update system settings"
ON public.system_settings
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins can insert system settings"
ON public.system_settings
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Seed an initial row if none exists
INSERT INTO public.system_settings (posting_paused)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);