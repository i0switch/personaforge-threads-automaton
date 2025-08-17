-- Add missing foreign key constraints for auto_post_configs
ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT fk_auto_post_configs_persona 
FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;

-- Add missing foreign key constraints for random_post_configs  
ALTER TABLE public.random_post_configs
ADD CONSTRAINT fk_random_post_configs_persona
FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;

-- Add user_id foreign key constraints as well for consistency
ALTER TABLE public.auto_post_configs 
ADD CONSTRAINT fk_auto_post_configs_user
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.random_post_configs
ADD CONSTRAINT fk_random_post_configs_user  
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;