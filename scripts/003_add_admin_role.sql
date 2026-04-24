-- Intikom Invoice Tracking System Database Migration
-- Version: 003
-- Description: Add admin role to user_role enum

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role'
      and e.enumlabel = 'admin'
  ) then
    alter type user_role add value 'admin';
  end if;
end $$;

