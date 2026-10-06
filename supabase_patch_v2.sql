-- Pace IT patch v2  (safe to run more than once)
-- Run in Supabase -> SQL Editor BEFORE deploying the new app code.
--
-- Adds:
--   1. Admin bin: everyone can delete, deleted logs/resellers go to the bin, only admin can restore or purge.
--   2. Resellers table (name, area, phone, active) seeded from your existing logs.
--   3. Password records so the admin panel can show usernames + passwords of accounts the admin creates.
--   4. New activity types (purged, password_reset).

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.disabled = false)
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Activity types
-- ---------------------------------------------------------------------------
alter table public.activity drop constraint if exists activity_action_check;
alter table public.activity add constraint activity_action_check check (action in (
  'created','edited','deleted','cleared','restored',
  'user_created','user_disabled','user_enabled','purged','password_reset'));

-- ---------------------------------------------------------------------------
-- 2. Logs: soft delete columns + new policies
-- ---------------------------------------------------------------------------
alter table public.logs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id),
  add column if not exists deleted_by_name text;
create index if not exists logs_deleted_at_idx on public.logs (deleted_at);

drop policy if exists "authenticated logs all" on public.logs;
drop policy if exists "logs select" on public.logs;
drop policy if exists "logs insert" on public.logs;
drop policy if exists "logs update" on public.logs;
drop policy if exists "logs delete admin" on public.logs;

-- Staff only see live logs. Admin sees everything (including the bin).
create policy "logs select" on public.logs for select to authenticated
  using (public.is_active_user() and (deleted_at is null or public.is_admin()));
create policy "logs insert" on public.logs for insert to authenticated
  with check (public.is_active_user() and (deleted_at is null or public.is_admin()));
create policy "logs update" on public.logs for update to authenticated
  using (public.is_active_user() and (deleted_at is null or public.is_admin()))
  with check (public.is_active_user() and (deleted_at is null or public.is_admin()));
-- Permanent deletes: admin only.
create policy "logs delete admin" on public.logs for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Resellers
-- ---------------------------------------------------------------------------
create table if not exists public.resellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by_name text,
  deleted_at timestamptz,
  deleted_by_name text
);
create unique index if not exists resellers_name_uq on public.resellers (lower(name)) where deleted_at is null;
alter table public.resellers enable row level security;

drop policy if exists "resellers select" on public.resellers;
drop policy if exists "resellers insert" on public.resellers;
drop policy if exists "resellers update" on public.resellers;
drop policy if exists "resellers delete admin" on public.resellers;
create policy "resellers select" on public.resellers for select to authenticated
  using (public.is_active_user() and (deleted_at is null or public.is_admin()));
create policy "resellers insert" on public.resellers for insert to authenticated
  with check (public.is_active_user() and deleted_at is null);
create policy "resellers update" on public.resellers for update to authenticated
  using (public.is_active_user() and deleted_at is null)
  with check (public.is_active_user() and deleted_at is null);
create policy "resellers delete admin" on public.resellers for delete to authenticated
  using (public.is_admin());

-- Seed from reseller names already used in logs ("Shabul- Balaganj" / "shabul - balaganj" = one reseller).
insert into public.resellers (name, area)
select distinct on (k) n, nullif(trim(split_part(n, '-', 2)), '')
from (
  select trim(data->>'resellerName') as n,
         lower(regexp_replace(regexp_replace(trim(data->>'resellerName'), '\s*-\s*', '-', 'g'), '\s+', ' ', 'g')) as k
  from public.logs
  where coalesce(trim(data->>'resellerName'), '') <> '' and deleted_at is null
) s
where not exists (
  select 1 from public.resellers r
  where r.deleted_at is null
    and lower(regexp_replace(regexp_replace(trim(r.name), '\s*-\s*', '-', 'g'), '\s+', ' ', 'g')) = s.k
)
order by k, n;

-- Edit a reseller; renaming also updates the name stored on that reseller's logs.
create or replace function public.update_reseller(p_id uuid, p_name text, p_area text, p_phone text, p_active boolean)
returns public.resellers
language plpgsql security definer set search_path = public as $$
declare
  old public.resellers;
  res public.resellers;
  nm text := trim(coalesce(p_name, ''));
  okey text;
begin
  if not public.is_active_user() then raise exception 'Not allowed.'; end if;
  if nm = '' then raise exception 'Reseller name is required.'; end if;
  select * into old from public.resellers where id = p_id and deleted_at is null;
  if old.id is null then raise exception 'Reseller not found.'; end if;

  update public.resellers
     set name = nm, area = nullif(trim(coalesce(p_area, '')), ''),
         phone = nullif(trim(coalesce(p_phone, '')), ''), active = coalesce(p_active, true)
   where id = p_id returning * into res;

  if old.name <> nm then
    okey := lower(regexp_replace(regexp_replace(trim(old.name), '\s*-\s*', '-', 'g'), '\s+', ' ', 'g'));
    update public.logs
       set data = jsonb_set(jsonb_set(data, '{resellerName}', to_jsonb(nm)), '{resellerId}', to_jsonb(p_id::text))
     where data->>'resellerId' = p_id::text
        or lower(regexp_replace(regexp_replace(trim(coalesce(data->>'resellerName', '')), '\s*-\s*', '-', 'g'), '\s+', ' ', 'g')) = okey;
  end if;
  return res;
exception when unique_violation then
  raise exception 'A reseller with that name already exists.';
end $$;
revoke all on function public.update_reseller(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.update_reseller(uuid, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Bin: everyone can delete (-> bin), admin restores / purges
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_log(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare nm text; l public.logs;
begin
  if not public.is_active_user() then raise exception 'Not allowed.'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  update public.logs set deleted_at = now(), deleted_by = auth.uid(), deleted_by_name = nm
   where id = p_id and deleted_at is null returning * into l;
  if l.id is null then raise exception 'Log not found.'; end if;
  insert into public.activity (by, by_name, action, log_no, customer, detail)
  values (auth.uid(), nm, 'deleted', l.log_no, l.data->>'customerName', 'Moved to admin bin');
end $$;

create or replace function public.soft_delete_all_logs()
returns integer language plpgsql security definer set search_path = public as $$
declare nm text; n integer;
begin
  if not public.is_active_user() then raise exception 'Not allowed.'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  update public.logs set deleted_at = now(), deleted_by = auth.uid(), deleted_by_name = nm where deleted_at is null;
  get diagnostics n = row_count;
  insert into public.activity (by, by_name, action, detail)
  values (auth.uid(), nm, 'cleared', n || ' logs moved to admin bin');
  return n;
end $$;

create or replace function public.soft_delete_reseller(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare nm text; r public.resellers;
begin
  if not public.is_active_user() then raise exception 'Not allowed.'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  update public.resellers set deleted_at = now(), deleted_by_name = nm
   where id = p_id and deleted_at is null returning * into r;
  if r.id is null then raise exception 'Reseller not found.'; end if;
  insert into public.activity (by, by_name, action, customer, detail)
  values (auth.uid(), nm, 'deleted', r.name, 'Reseller "' || r.name || '" moved to admin bin');
end $$;

create or replace function public.admin_restore_log(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.logs;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  update public.logs set deleted_at = null, deleted_by = null, deleted_by_name = null
   where id = p_id and deleted_at is not null returning * into l;
  if l.id is null then raise exception 'Log not found in the bin.'; end if;
  insert into public.activity (by, by_name, action, log_no, customer, detail)
  values (auth.uid(), 'Administrator', 'restored', l.log_no, l.data->>'customerName', 'Restored from bin');
end $$;

create or replace function public.admin_restore_reseller(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.resellers;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  update public.resellers set deleted_at = null, deleted_by_name = null
   where id = p_id and deleted_at is not null returning * into r;
  if r.id is null then raise exception 'Reseller not found in the bin.'; end if;
  insert into public.activity (by, by_name, action, customer, detail)
  values (auth.uid(), 'Administrator', 'restored', r.name, 'Reseller "' || r.name || '" restored from bin');
exception when unique_violation then
  raise exception 'A live reseller with that name already exists. Rename or delete it first.';
end $$;

create or replace function public.admin_purge_log(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.logs;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  delete from public.logs where id = p_id and deleted_at is not null returning * into l;
  if l.id is null then raise exception 'Log not found in the bin.'; end if;
  insert into public.activity (by, by_name, action, log_no, customer, detail)
  values (auth.uid(), 'Administrator', 'purged', l.log_no, l.data->>'customerName', 'Deleted forever from bin');
end $$;

create or replace function public.admin_purge_reseller(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.resellers;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  delete from public.resellers where id = p_id and deleted_at is not null returning * into r;
  if r.id is null then raise exception 'Reseller not found in the bin.'; end if;
  insert into public.activity (by, by_name, action, customer, detail)
  values (auth.uid(), 'Administrator', 'purged', r.name, 'Reseller "' || r.name || '" deleted forever from bin');
end $$;

create or replace function public.admin_empty_bin()
returns integer language plpgsql security definer set search_path = public as $$
declare a integer; b integer;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  delete from public.logs where deleted_at is not null;
  get diagnostics a = row_count;
  delete from public.resellers where deleted_at is not null;
  get diagnostics b = row_count;
  insert into public.activity (by, by_name, action, detail)
  values (auth.uid(), 'Administrator', 'purged', 'Bin emptied: ' || a || ' logs, ' || b || ' resellers');
  return a + b;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'soft_delete_log(uuid)', 'soft_delete_all_logs()', 'soft_delete_reseller(uuid)',
    'admin_restore_log(uuid)', 'admin_restore_reseller(uuid)', 'admin_purge_log(uuid)',
    'admin_purge_reseller(uuid)', 'admin_empty_bin()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Password records (admin can see credentials of accounts it creates / resets)
--    Stored in a table nobody can read through the API; only the admin RPC below returns it.
--    If a user changes their own password, the stored copy is deleted (it would be stale).
-- ---------------------------------------------------------------------------
create table if not exists public.user_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);
alter table public.user_credentials enable row level security;
revoke all on table public.user_credentials from anon, authenticated;

create or replace function public.admin_list_credentials()
returns table (user_id uuid, password text)
language sql stable security definer set search_path = public as $$
  select c.user_id, c.password from public.user_credentials c where public.is_admin()
$$;

create or replace function public.note_my_password_changed()
returns void language sql security definer set search_path = public as $$
  delete from public.user_credentials where user_id = auth.uid()
$$;

create or replace function public.admin_reset_user_password(p_user_id uuid, p_password text)
returns boolean language plpgsql security definer set search_path = public, auth, extensions as $$
declare uname text; dname text;
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if p_user_id = auth.uid() then raise exception 'Use "Change admin password" for your own account.'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  select username, display_name into uname, dname from public.profiles where id = p_user_id;
  if uname is null then raise exception 'User not found.'; end if;

  perform public.internal_upsert_auth_user(uname || '@pace-it.internal', p_password, uname, dname);
  insert into public.user_credentials (user_id, password) values (p_user_id, p_password)
    on conflict (user_id) do update set password = excluded.password, updated_at = now();
  insert into public.activity (by, by_name, action, detail)
  values (auth.uid(), 'Administrator', 'password_reset', 'Password reset for ' || uname);
  return true;
end $$;

-- Same as before, but also remembers the initial password.
create or replace function public.admin_create_user(p_username text, p_password text, p_display_name text)
returns public.profiles language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  caller_role text;
  new_id uuid;
  normalized text := lower(trim(p_username));
  clean_name text := nullif(trim(p_display_name), '');
  result public.profiles;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'admin' then raise exception 'Admin access required.'; end if;
  if normalized !~ '^[a-z0-9][a-z0-9._-]{1,63}$' then raise exception 'Invalid username.'; end if;
  if length(p_password) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  if exists (select 1 from public.profiles where username = normalized) then raise exception 'That username already exists.'; end if;

  new_id := public.internal_upsert_auth_user(
    normalized || '@pace-it.internal', p_password, normalized, coalesce(clean_name, normalized));

  insert into public.profiles (id, username, display_name, role, disabled)
  values (new_id, normalized, coalesce(clean_name, normalized), 'user', false)
  returning * into result;

  insert into public.user_credentials (user_id, password) values (new_id, p_password)
    on conflict (user_id) do update set password = excluded.password, updated_at = now();

  insert into public.activity (by, by_name, action, detail)
  values (auth.uid(), 'Administrator', 'user_created',
          'Created user account: ' || normalized || ' (' || coalesce(clean_name, normalized) || ')');
  return result;
exception when unique_violation then
  raise exception 'That username already exists.';
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_list_credentials()', 'note_my_password_changed()',
    'admin_reset_user_password(uuid, text)', 'admin_create_user(text, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Realtime for resellers
-- ---------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.resellers; exception when duplicate_object then null; end;
end $$;
