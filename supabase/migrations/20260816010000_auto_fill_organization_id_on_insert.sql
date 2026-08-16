-- Bug: the frontend's insert calls for sites/staff/shifts never set
-- organization_id, so every one of them hit "new row violates row-level
-- security policy" (the WITH CHECK on each *_admin_insert/_write policy
-- requires organization_id = my_org_id(), and an omitted column is NULL,
-- which never equals my_org_id()).
--
-- Fixed at the DB layer instead of patching each frontend call site: a
-- BEFORE INSERT trigger fills in organization_id from my_org_id() whenever
-- the caller didn't supply one. This also closes the whole bug class for
-- any insert path added later. It's a no-op for signup_organization()'s
-- staff insert, which already sets organization_id explicitly (my_org_id()
-- is null at that point anyway, since no staff row exists yet).
create or replace function set_organization_id() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := my_org_id();
  end if;
  return new;
end;
$$;

create trigger sites_set_organization_id before insert on sites
  for each row execute function set_organization_id();
create trigger staff_set_organization_id before insert on staff
  for each row execute function set_organization_id();
create trigger shifts_set_organization_id before insert on shifts
  for each row execute function set_organization_id();
