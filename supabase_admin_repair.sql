-- Pace-IT administrator repair  (safe to run any number of times)
-- Run this in Supabase SQL Editor if admin / admin does not work.
--
-- What it fixes:
--   * adds the missing auth.identities row + empty token columns that Supabase Auth requires
--   * creates the admin account if missing, otherwise resets its password to 'admin'
--   * repairs every other account that was created by the old admin_create_user function
--   * replaces admin_create_user so NEW accounts are created correctly
--   * makes sure the username -> email lookup function exists
-- Requires the tables from supabase_schema.sql (public.profiles etc.).
-- Change the admin password right after logging in.

create extension if not exists pgcrypto;

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

do $$
declare
  admin_id uuid;
  r record;
begin
  -- Find the admin auth user (by email, or via an existing 'admin' profile).
  select id into admin_id from auth.users where lower(email) = 'admin@pace-it.internal' limit 1;
  if admin_id is null then
    select id into admin_id from public.profiles where username = 'admin' limit 1;
    if admin_id is not null then
      update auth.users set email = 'admin@pace-it.internal' where id = admin_id;
    end if;
  end if;

  -- Any other profile squatting on the username 'admin' is renamed and disabled.
  update public.profiles
     set username = 'admin_old_' || left(id::text, 8), role = 'user', disabled = true
   where username = 'admin' and id is distinct from admin_id;

  -- Create or reset the admin (password: admin).
  admin_id := public.internal_upsert_auth_user('admin@pace-it.internal', 'admin', 'admin', 'Administrator');

  insert into public.profiles (id, username, display_name, role, disabled)
  values (admin_id, 'admin', 'Administrator', 'admin', false)
  on conflict (id) do update
    set username = 'admin', display_name = 'Administrator', role = 'admin', disabled = false;

  -- Repair every other app account (passwords are left untouched).
  for r in select id from auth.users where lower(email) like '%@pace-it.internal' loop
    perform public.internal_repair_auth_user(r.id);
  end loop;
end $$;

-- Result: every column should be true / admin / false.
select
  u.email,
  u.email_confirmed_at is not null                                   as confirmed,
  u.encrypted_password = extensions.crypt('admin', u.encrypted_password) as password_is_admin,
  u.confirmation_token is not null and u.recovery_token is not null  as tokens_ok,
  exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email') as has_identity,
  p.username, p.role, p.disabled,
  public.get_login_email('admin')                                    as login_email_lookup
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'admin@pace-it.internal';
