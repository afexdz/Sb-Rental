begin;

create table public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  created_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant update (full_name) on public.customer_profiles to authenticated;

create policy "Clients lisent leur profil" on public.customer_profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Clients modifient leur nom" on public.customer_profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.create_customer_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.customer_profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100));
  return new;
end;
$$;
revoke all on function public.create_customer_profile() from public, anon, authenticated;
create trigger on_auth_user_created_customer_profile
  after insert on auth.users for each row execute function public.create_customer_profile();

-- Préserve les comptes existants et leur crée un profil, sans toucher à Auth.
insert into public.customer_profiles (id, full_name, created_at)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 100), created_at
from auth.users on conflict (id) do nothing;
commit;
