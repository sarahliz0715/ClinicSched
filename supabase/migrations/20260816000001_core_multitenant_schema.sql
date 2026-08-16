-- ClinicSched multi-tenant core schema
-- Applied directly to the "ClinicSched" Supabase project (iedhdbtxrpxuxlkhiejx)
-- via the Supabase MCP migration tool. Kept here for history/review — this
-- repo doesn't currently run `supabase db push` in CI, so if you need to
-- reapply this against a different project, paste it into the SQL editor
-- (or run `supabase db push` once the CLI is linked).
create extension if not exists pgcrypto;
create extension if not exists citext;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  public_share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email citext not null,
  role text not null default 'staff' check (role in ('admin','staff')),
  lead text,
  invite_token uuid default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  date date not null,
  start_time time not null default '07:00',
  end_time time not null default '15:00',
  notes text not null default '',
  status text not null default 'assigned' check (status in ('assigned','open','claimed')),
  claimed_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shifts_org_date_idx on shifts(organization_id, date);
create index shifts_org_status_idx on shifts(organization_id, status);
create index staff_org_idx on staff(organization_id);
create index sites_org_idx on sites(organization_id);

create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger shifts_set_updated_at before update on shifts
  for each row execute function set_updated_at();

-- ── Helper functions (SECURITY DEFINER so they can read `staff` even
--    though RLS on `staff` itself only allows reading your own org) ──────
create or replace function my_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from staff where auth_user_id = auth.uid() limit 1;
$$;

create or replace function my_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from staff where auth_user_id = auth.uid() limit 1;
$$;

create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from staff where auth_user_id = auth.uid() limit 1;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table sites enable row level security;
alter table staff enable row level security;
alter table shifts enable row level security;

create policy organizations_select on organizations for select
  using (id = my_org_id());
-- No direct insert/update/delete policy for organizations: creation only
-- happens through the signup_organization() SECURITY DEFINER function below.

create policy sites_select on sites for select
  using (organization_id = my_org_id());
create policy sites_admin_write on sites for insert
  with check (organization_id = my_org_id() and my_role() = 'admin');
create policy sites_admin_update on sites for update
  using (organization_id = my_org_id() and my_role() = 'admin')
  with check (organization_id = my_org_id());
create policy sites_admin_delete on sites for delete
  using (organization_id = my_org_id() and my_role() = 'admin');

create policy staff_select on staff for select
  using (organization_id = my_org_id());
create policy staff_admin_insert on staff for insert
  with check (organization_id = my_org_id() and my_role() = 'admin');
create policy staff_admin_update on staff for update
  using (organization_id = my_org_id() and my_role() = 'admin')
  with check (organization_id = my_org_id());
create policy staff_admin_delete on staff for delete
  using (organization_id = my_org_id() and my_role() = 'admin' and auth_user_id is distinct from auth.uid());

create policy shifts_select on shifts for select
  using (organization_id = my_org_id());
create policy shifts_admin_insert on shifts for insert
  with check (organization_id = my_org_id() and my_role() = 'admin');
create policy shifts_update on shifts for update
  using (
    organization_id = my_org_id()
    and (my_role() = 'admin' or status = 'open')
  )
  with check (
    organization_id = my_org_id()
    and (
      my_role() = 'admin'
      or (status = 'assigned' and staff_id = my_staff_id())
    )
  );
create policy shifts_admin_delete on shifts for delete
  using (organization_id = my_org_id() and my_role() = 'admin');

-- ── Signup / invite RPCs (bypass RLS deliberately, enforce their own
--    invariants — this is how a brand-new user is allowed to create an
--    organization+admin row, and how an invited user links their new
--    auth account to the staff row an admin already created for them) ──
create or replace function signup_organization(org_name text, admin_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'must be authenticated'; end if;
  if exists (select 1 from staff where auth_user_id = uid) then
    raise exception 'this account is already linked to an organization';
  end if;
  insert into organizations(name) values (org_name) returning id into new_org_id;
  insert into staff(organization_id, auth_user_id, name, email, role)
    values (new_org_id, uid, admin_name, auth.email(), 'admin');
  return new_org_id;
end;
$$;
grant execute on function signup_organization(text, text) to authenticated;

create or replace function accept_staff_invite(token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target staff%rowtype;
begin
  if uid is null then raise exception 'must be authenticated'; end if;
  if exists (select 1 from staff where auth_user_id = uid) then
    raise exception 'this account is already linked to an organization';
  end if;
  select * into target from staff where invite_token = token and auth_user_id is null;
  if target.id is null then raise exception 'invalid or already-used invite link'; end if;
  update staff set auth_user_id = uid, invite_token = null where id = target.id;
  return target.organization_id;
end;
$$;
grant execute on function accept_staff_invite(uuid) to authenticated;
