-- Admin visibility policies for monitoring dashboard
-- Personas: allow admins to SELECT all rows
CREATE POLICY "Admins can view all personas"
ON public.personas
FOR SELECT
USING (is_admin(auth.uid()));

-- Auto post configs: allow admins to SELECT all rows
CREATE POLICY "Admins can view all auto post configs"
ON public.auto_post_configs
FOR SELECT
USING (is_admin(auth.uid()));

-- Random post configs: allow admins to SELECT all rows
CREATE POLICY "Admins can view all random post configs"
ON public.random_post_configs
FOR SELECT
USING (is_admin(auth.uid()));