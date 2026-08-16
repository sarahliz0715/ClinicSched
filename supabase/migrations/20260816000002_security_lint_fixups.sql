-- Pin search_path on the trigger function (was flagged mutable by the
-- Supabase advisor).
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Move citext out of the public schema per the Supabase extension-placement
-- advisory.
create schema if not exists extensions;
alter extension citext set schema extensions;

-- signup_organization / accept_staff_invite both require auth.uid() to be
-- non-null (they raise immediately otherwise), so the anon role has no
-- legitimate reason to call them directly.
revoke execute on function signup_organization(text, text) from anon;
revoke execute on function accept_staff_invite(uuid) from anon;
