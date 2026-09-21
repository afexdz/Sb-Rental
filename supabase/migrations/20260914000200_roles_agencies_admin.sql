begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '' check (char_length(full_name) <= 100),
  role text not null default 'client' check (role in ('client', 'agency')),
  created_at timestamptz not null default now()
);

create table public.app_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

insert into public.app_admins (email) values ('admin@sbrental.local') on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.app_admins enable row level security;
revoke all on public.profiles, public.app_admins from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create policy "Utilisateurs lisent leur profil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id or (select public.is_admin()));
create policy "Admins modifient les profils" on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role, created_at)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    case when new.raw_user_meta_data ->> 'role' = 'agency' then 'agency' else 'client' end,
    coalesce(new.created_at, now())
  ) on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, role = excluded.role;
  return new;
end;
$$;
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
create trigger on_auth_user_created_profile
  after insert on auth.users for each row execute function public.create_profile_for_user();

insert into public.profiles (id, email, full_name, role, created_at)
select id, lower(coalesce(email, '')), left(coalesce(raw_user_meta_data ->> 'full_name', ''), 100),
  case when raw_user_meta_data ->> 'role' = 'agency' then 'agency' else 'client' end, created_at
from auth.users on conflict (id) do nothing;

create table public.agency_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  rc_number text not null check (char_length(rc_number) between 2 and 80),
  document_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_changes')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.agency_requests enable row level security;
revoke all on public.agency_requests from anon, authenticated;
grant select, insert on public.agency_requests to authenticated;
grant update (status, admin_note, reviewed_at) on public.agency_requests to authenticated;

create policy "Agences créent leur demande" on public.agency_requests
  for insert to authenticated with check ((select auth.uid()) = profile_id and exists (select 1 from public.profiles p where p.id = profile_id and p.role = 'agency'));
create policy "Agences voient leur demande" on public.agency_requests
  for select to authenticated using ((select auth.uid()) = profile_id or (select public.is_admin()));
create policy "Admins traitent les demandes" on public.agency_requests
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-documents', 'agency-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

create policy "Agences déposent leur registre" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'agency-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Admins lisent les registres" on storage.objects
  for select to authenticated using (bucket_id = 'agency-documents' and (select public.is_admin()));

commit;
