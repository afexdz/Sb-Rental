begin;

-- Approval comes from trusted database rows, never user-editable Auth metadata.
create function public.is_approved_agency()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.agency_requests r on r.profile_id = p.id
    where p.id = (select auth.uid()) and p.role = 'agency'
      and p.account_status = 'active' and r.status = 'approved'
  );
$$;
revoke all on function public.is_approved_agency() from public, anon, authenticated;
grant execute on function public.is_approved_agency() to authenticated;

create table public.agency_profiles (
  id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 160),
  slug text not null unique default ('agence-' || replace(auth.uid()::text, '-', ''))
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  logo_path text check (logo_path is null or (logo_path like id::text || '/%' and logo_path !~ '(^|/)\.\.(/|$)')),
  phone text not null default '' check (char_length(phone) <= 30),
  address text not null default '' check (char_length(address) <= 250),
  city text not null default '' check (char_length(city) <= 100),
  description text not null default '' check (char_length(description) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agency_profiles enable row level security;
revoke all on public.agency_profiles from anon, authenticated;
grant select on public.agency_profiles to authenticated;
grant insert (id, display_name, logo_path, phone, address, city, description) on public.agency_profiles to authenticated;
grant update (display_name, logo_path, phone, address, city, description) on public.agency_profiles to authenticated;
create policy "Approved agency reads own shop" on public.agency_profiles for select to authenticated
  using (id = (select auth.uid()) and (select public.is_approved_agency()));
create policy "Approved agency creates own shop" on public.agency_profiles for insert to authenticated
  with check (id = (select auth.uid()) and (select public.is_approved_agency()));
create policy "Approved agency updates own shop" on public.agency_profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_approved_agency()))
  with check (id = (select auth.uid()) and (select public.is_approved_agency()));
create function public.touch_agency_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_agency_profile() from public, anon, authenticated;
create trigger touch_agency_profile before update on public.agency_profiles
  for each row execute function public.touch_agency_profile();

alter table public.vehicles add column color text not null default '' check (char_length(color) <= 60);
-- Enforce all new writes without deleting/truncating any legacy photo arrays.
alter table public.vehicles add constraint vehicles_max_three_photos check (cardinality(photos) <= 3) not valid;
do $$ begin
  if not exists (select 1 from public.vehicles where cardinality(photos) > 3) then
    alter table public.vehicles validate constraint vehicles_max_three_photos;
  end if;
end $$;

-- Retain admin read access. No vehicle DELETE grant; agencies deactivate instead.
alter policy "Vehicles owner or admin" on public.vehicles
  using ((select public.is_admin()) or (agency_id = (select auth.uid()) and (select public.is_approved_agency())));
grant insert (agency_id, brand, model, category, year, daily_price_cents, color, description, availability, active, photos)
  on public.vehicles to authenticated;
-- agency_id, id, currency and created_at are deliberately not writable on UPDATE.
grant update (brand, model, category, year, daily_price_cents, color, description, availability, active, photos)
  on public.vehicles to authenticated;
create policy "Approved agency creates own vehicles" on public.vehicles for insert to authenticated
  with check (agency_id = (select auth.uid()) and (select public.is_approved_agency()));
create policy "Approved agency updates own vehicles" on public.vehicles for update to authenticated
  using (agency_id = (select auth.uid()) and (select public.is_approved_agency()))
  with check (agency_id = (select auth.uid()) and (select public.is_approved_agency()));

-- Separate public marketing assets from private registration documents.
-- A conflicting pre-existing bucket makes the migration fail atomically, without overwriting it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-assets', 'agency-assets', true, 409600, array['image/webp', 'image/jpeg']);
create policy "Approved agency lists own assets" on storage.objects for select to authenticated
  using (bucket_id = 'agency-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved_agency()));
create policy "Approved agency uploads own assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'agency-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved_agency()));
create policy "Approved agency updates own assets" on storage.objects for update to authenticated
  using (bucket_id = 'agency-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved_agency()))
  with check (bucket_id = 'agency-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved_agency()));
create policy "Approved agency deletes own assets" on storage.objects for delete to authenticated
  using (bucket_id = 'agency-assets' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_approved_agency()));

commit;
