-- Defense in depth: anonymous clients do not need access to user roles.
-- Keep authenticated and privileged role grants and existing RLS policies intact.
REVOKE ALL PRIVILEGES ON TABLE public.user_roles FROM anon;
