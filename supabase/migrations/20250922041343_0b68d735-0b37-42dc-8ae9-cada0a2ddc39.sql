-- Fix missing profile and account status for tsuyo@t user
INSERT INTO public.profiles (user_id, display_name, created_at, updated_at)
VALUES (
  'ea2b6512-cff8-4222-9a21-4d7a430ee667',
  'tsuyo@t',
  '2025-09-22 04:03:05+00',
  now()
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_account_status (
  user_id, 
  is_active, 
  is_approved, 
  persona_limit,
  created_at,
  updated_at
)
VALUES (
  'ea2b6512-cff8-4222-9a21-4d7a430ee667',
  true,
  true, 
  1,
  '2025-09-22 04:03:05+00',
  now()
) ON CONFLICT (user_id) DO NOTHING;