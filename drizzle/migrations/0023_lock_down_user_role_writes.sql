-- Prevent role escalation through direct client writes.
-- Seller onboarding and authorized admin RPCs use SECURITY DEFINER;
-- ordinary authenticated clients must never INSERT/UPDATE/DELETE roles.
alter table public.user_roles enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_roles'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.user_roles', p.policyname);
  end loop;
end $$;

-- Keep existing SELECT policies intact. A direct client mutation now has no
-- applicable write policy; the service role and privileged security-definer
-- functions continue to operate through their existing authorization checks.
