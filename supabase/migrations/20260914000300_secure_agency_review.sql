begin;

-- Bind existing administrators to their account ID. An email registered or changed
-- later must never grant administrative rights automatically.
alter table public.app_admins add column user_id uuid unique references auth.users(id) on delete cascade;
update public.app_admins a set user_id = u.id from auth.users u where lower(u.email) = a.email;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;

-- An agency cannot submit an already approved request or forge review fields.
revoke insert on public.agency_requests from authenticated;
grant insert (profile_id, business_name, rc_number, document_path) on public.agency_requests to authenticated;
drop policy "Agences créent leur demande" on public.agency_requests;
create policy "Agences créent leur demande" on public.agency_requests
for insert to authenticated with check (
  (select auth.uid()) = profile_id
  and status = 'pending' and admin_note is null and reviewed_at is null
  and exists (select 1 from public.profiles p where p.id = profile_id and p.role = 'agency')
  and (storage.foldername(document_path))[1] = (select auth.uid())::text
  and exists (select 1 from storage.objects o where o.bucket_id = 'agency-documents' and o.name = document_path)
);

drop policy "Agences déposent leur registre" on storage.objects;
create policy "Agences déposent leur registre" on storage.objects
for insert to authenticated with check (
  bucket_id = 'agency-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'agency')
);
create policy "Agences lisent leur registre" on storage.objects
for select to authenticated using (
  bucket_id = 'agency-documents' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'agency')
);

-- Keep the admin directory consistent with the existing account editing feature.
create function public.sync_customer_profile_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set full_name = new.full_name where id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_customer_profile_name() from public, anon, authenticated;
create trigger on_customer_name_changed after update of full_name on public.customer_profiles
for each row execute function public.sync_customer_profile_name();
update public.profiles p set full_name = c.full_name from public.customer_profiles c where c.id = p.id;

create function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
create trigger on_auth_email_changed after update of email on auth.users
for each row execute function public.sync_profile_email();
commit;
