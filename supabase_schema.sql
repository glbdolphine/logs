-- Pace-IT shared backend
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role text not null default 'user' check (role in ('admin','user')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key,
  log_no numeric not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  by uuid references public.profiles(id),
  by_name text not null,
  action text not null check (action in ('created','edited','deleted','cleared','restored','user_created','user_disabled','user_enabled')),
  log_no numeric,
  customer text,
  detail text
);

create table if not exists public.suggestions (
  field text primary key,
  values jsonb not null default '[]'::jsonb
);

-- Keep profile creation available for the initial admin bootstrap.
alter table public.profiles enable row level security;
alter table public.logs enable row level security;
alter table public.activity enable row level security;
alter table public.suggestions enable row level security;

drop policy if exists "authenticated profiles read" on public.profiles;
create policy "authenticated profiles read" on public.profiles
  for select to authenticated using (true);

drop policy if exists "authenticated logs all" on public.logs;
create policy "authenticated logs all" on public.logs
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false));

drop policy if exists "authenticated activity read" on public.activity;
create policy "authenticated activity read" on public.activity
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false));
drop policy if exists "authenticated activity insert" on public.activity;
create policy "authenticated activity insert" on public.activity
  for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false));

drop policy if exists "authenticated suggestions all" on public.suggestions;
create policy "authenticated suggestions all" on public.suggestions
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.disabled = false));

-- ---------------------------------------------------------------------------
-- Auth helpers (internal, not callable from the browser).
-- Supabase Auth (GoTrue) can only sign in users that have:
--   1) an auth.identities row for the email provider, and
--   2) empty-string (not NULL) token columns in auth.users.
-- Inserting into auth.users alone is NOT enough, which is why logins fail
-- with "invalid password" even though the password hash is correct.
-- ---------------------------------------------------------------------------
create or replace function public.internal_repair_auth_user(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  update auth.users
     set aud                        = coalesce(aud, 'authenticated'),
         role                       = coalesce(role, 'authenticated'),
         email_confirmed_at         = coalesce(email_confirmed_at, now()),
         confirmation_token         = coalesce(confirmation_token, ''),
         recovery_token             = coalesce(recovery_token, ''),
         email_change_token_new     = coalesce(email_change_token_new, ''),
         email_change               = coalesce(email_change, ''),
         email_change_token_current = coalesce(email_change_token_current, ''),
         reauthentication_token     = coalesce(reauthentication_token, ''),
         phone_change               = coalesce(phone_change, ''),
         phone_change_token         = coalesce(phone_change_token, ''),
         raw_app_meta_data          = coalesce(raw_app_meta_data, '{}'::jsonb)
                                      || '{"provider":"email","providers":["email"]}'::jsonb,
         updated_at                 = now()
   where id = p_id;

  delete from auth.identities where user_id = p_id and provider = 'email';

  insert into auth.identities (id, provider_id, user_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email,
                            'email_verified', true, 'phone_verified', false),
         'email', now(), now(), now()
    from auth.users u
   where u.id = p_id;
end;
$$;

create or replace function public.internal_upsert_auth_user(
  p_email text,
  p_password text,
  p_username text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email) limit 1;

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token, phone_change, phone_change_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid, 'authenticated', 'authenticated',
      lower(p_email),
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', p_username, 'display_name', p_display_name),
      '', '', '', '', '', '', '', ''
    );
  else
    update auth.users
       set encrypted_password = crypt(p_password, gen_salt('bf')),
           raw_user_meta_data = jsonb_build_object('username', p_username, 'display_name', p_display_name)
     where id = uid;
  end if;

  perform public.internal_repair_auth_user(uid);
  return uid;
end;
$$;

revoke all on function public.internal_repair_auth_user(uuid) from public, anon, authenticated;
revoke all on function public.internal_upsert_auth_user(text,text,text,text) from public, anon, authenticated;

-- Admin account management. These functions run with elevated privileges
-- but verify that the caller is an authenticated administrator first.
create or replace function public.admin_create_user(
  p_username text,
  p_password text,
  p_display_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
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
  if exists(select 1 from public.profiles where username = normalized) then raise exception 'That username already exists.'; end if;

  new_id := public.internal_upsert_auth_user(
    normalized || '@pace-it.internal', p_password, normalized, coalesce(clean_name, normalized)
  );

  insert into public.profiles(id, username, display_name, role, disabled)
  values(new_id, normalized, coalesce(clean_name, normalized), 'user', false)
  returning * into result;

  insert into public.activity(by, by_name, action, detail)
  values(auth.uid(), 'Administrator', 'user_created',
         'Created user account: ' || normalized || ' (' || coalesce(clean_name, normalized) || ')');

  return result;
exception
  when unique_violation then
    raise exception 'That username already exists.';
end;
$$;

revoke all on function public.admin_create_user(text,text,text) from public;
grant execute on function public.admin_create_user(text,text,text) to authenticated;


create or replace function public.admin_set_user_disabled(
  p_user_id uuid,
  p_disabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role text;
  target_username text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role <> 'admin' then raise exception 'Admin access required.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot disable the current admin account.'; end if;

  update public.profiles set disabled = p_disabled where id = p_user_id returning username into target_username;
  if target_username is null then raise exception 'User not found.'; end if;

  -- Auth sessions for a disabled account are blocked on the next password login.
  insert into public.activity(by, by_name, action, detail)
  values(auth.uid(), 'Administrator',
         case when p_disabled then 'user_disabled' else 'user_enabled' end,
         case when p_disabled then 'Disabled user account: ' else 'Enabled user account: ' end || target_username);

  return true;
end;
$$;

revoke all on function public.admin_set_user_disabled(uuid,boolean) from public;
grant execute on function public.admin_set_user_disabled(uuid,boolean) to authenticated;

-- Username -> internal email lookup used before password login.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select concat(username, '@pace-it.internal')
  from public.profiles
  where username = lower(trim(p_username))
    and disabled = false
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- Bootstrap admin: username admin, password admin (only if no admin profile exists yet).
-- If login still fails afterwards, run supabase_admin_repair.sql.
do $$
declare
  admin_id uuid;
begin
  if not exists (select 1 from public.profiles where username = 'admin') then
    admin_id := public.internal_upsert_auth_user('admin@pace-it.internal', 'admin', 'admin', 'Administrator');
    insert into public.profiles (id, username, display_name, role, disabled)
    values (admin_id, 'admin', 'Administrator', 'admin', false)
    on conflict (id) do update
      set username='admin', display_name='Administrator', role='admin', disabled=false;
  end if;
end $$;

-- Seed the suggestion fields.
insert into public.suggestions(field, values) values
('resellerName', '["Shabul- Balaganj","Rahman- Sylhet Sadar","Kabir- Beanibazar","Alam- Golapganj","Faruk- Biswanath"]'),
('callerPhone', '["+880 1680-945894","+880 1711-234567","+880 1912-345678"]'),
('requestType', '["New User ID","Form Submission","Bandwidth Upgrade","Router Relocation","Profile Modification","MAC Binding Reset","IP Address Re-assignment"]'),
('customerName', '["Hasampur Govt. Primary School","Radhakona Govt. Primary School","Sreemangal Model High School","Balaganj Technical Institute"]'),
('nmsId', '[]'),
('issueFound', '["Same router at two institute","MAC address collision in NMS","Incorrect package assigned","Port link down on OLT","VLAN mismatch at reseller switch"]'),
('missingWrongDetails', '["They previously used the same router in Radhakona Govt. Primary School","National ID card copy missing from form","Phone number mismatch on application form","Previous billing clearance pending"]'),
('actionTaken', '["Provided the id/form as requested but kept nms entry on hold","Created user ID in NMS and notified reseller via WhatsApp","Updated MAC binding in authentication server","Forwarded ticket to Core NOC team for IP remapping"]'),
('reasonForAction', '["I did not entry this school in nms because nms doesn''t allow two school with same router.","Awaiting confirmation of router decommissioning from previous site.","Verified payment voucher with accounts before activating profile."]'),
('resellerInformed', '["Yes - phone","Yes - WhatsApp","Yes - email","Yes - in-person","No - unanswered phone call","No - SMS sent"]'),
('followUpNeeded', '["Yes","No","Pending reseller callback","Pending supervisor review"]'),
('status', '["Pending - waiting for reseller","In Progress","Resolved","Escalated to Core Team","On Hold","Closed"]'),
('supervisorInformed', '["I informed my superiors","Approved by Team Lead","Informed Operations Manager","Escalated to Duty Manager","No approval needed (standard request)"]'),
('remarks', '["Reseller said Radhakona Govt. Primary School is not using the network or the router anymore. So they decided to use it for another school.","Reseller promised to submit the formal decommissioning request by tomorrow.","Client requested urgent activation before morning classes."]'),
('mac', '["20:23:51:78:49:F4","44:D9:E7:2B:1A:08","E4:5F:01:8C:3D:A2"]')
on conflict (field) do nothing;

-- Realtime (safe to run more than once)
do $$
begin
  begin alter publication supabase_realtime add table public.logs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.activity; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.suggestions; exception when duplicate_object then null; end;
end $$;
