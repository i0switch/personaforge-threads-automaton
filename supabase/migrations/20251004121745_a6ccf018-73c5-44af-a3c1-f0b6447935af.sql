-- Add foreign key constraint to template_random_post_configs
ALTER TABLE public.template_random_post_configs
ADD CONSTRAINT template_random_post_configs_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;

-- Add foreign key constraint for user_id as well
ALTER TABLE public.template_random_post_configs
ADD CONSTRAINT template_random_post_configs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;