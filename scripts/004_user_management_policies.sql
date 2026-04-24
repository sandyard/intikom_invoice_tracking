-- Intikom Invoice Tracking System Database Migration
-- Version: 004
-- Description: Allow finance/admin to manage users

-- Allow finance/admin to update any row in public.users (role, is_active, etc.)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'users_update_finance_admin'
  ) then
    execute $policy$
      create policy "users_update_finance_admin" on public.users
        for update
        using (
          exists (
            select 1 from public.users
            where id = auth.uid() and role in ('finance', 'admin')
          )
        );
    $policy$;
  end if;
end $$;

