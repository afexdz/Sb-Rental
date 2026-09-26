begin;

-- Additive: existing profiles, documents, reservations and payments are retained.
create table public.client_verifications (
  client_id uuid primary key references public.profiles(id),
  first_name text not null default '' check (char_length(first_name) <= 50),
  last_name text not null default '' check (char_length(last_name) <= 50),
  phone text not null default '' check (char_length(phone) <= 30),
  contact_email text not null default '' check (char_length(contact_email) <= 254),
  passport_path text,
  status text not null default 'pending' check (status in ('pending','verified')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);
insert into public.client_verifications(client_id) select id from public.profiles where role = 'client';
create function public.initialize_client_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'client' then insert into public.client_verifications(client_id) values(new.id) on conflict do nothing; end if;
  return new;
end $$;
revoke all on function public.initialize_client_verification() from public, anon, authenticated;
create trigger initialize_client_verification after insert on public.profiles for each row execute function public.initialize_client_verification();

create table public.passport_access (
  conversation_id uuid primary key references public.conversations(id),
  requested_at timestamptz not null default now(),
  granted_path text,
  granted_at timestamptz
);
alter table public.client_verifications enable row level security;
alter table public.passport_access enable row level security;
revoke all on public.client_verifications, public.passport_access from anon, authenticated;
grant select on public.client_verifications, public.passport_access to authenticated;
create policy "Client or admin reads verification" on public.client_verifications for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_admin()));
create policy "Participants read passport request" on public.passport_access for select to authenticated using (
  (select public.is_admin()) or exists(select 1 from public.conversations c where c.id = conversation_id and (c.client_id = (select auth.uid()) or c.agency_id = (select auth.uid())))
);

create function public.agency_is_verified(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join public.agency_requests a on a.profile_id = p.id where p.id = target and p.role = 'agency' and p.account_status = 'active' and a.status = 'approved');
$$;
create function public.client_is_verified(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.client_verifications v join public.profiles p on p.id = v.client_id where p.id = target and p.role = 'client' and p.account_status = 'active' and v.status = 'verified' and v.passport_path is not null);
$$;
create function public.can_read_passport(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.client_verifications v join public.profiles p on p.id = v.client_id
    where v.passport_path = path and p.account_status = 'active' and (
      v.client_id = auth.uid() or exists (
        select 1 from public.passport_access a join public.conversations c on c.id = a.conversation_id
        where c.client_id = v.client_id and c.agency_id = auth.uid() and c.status = 'active'
          and a.granted_path = path and a.granted_at is not null and public.agency_is_verified(c.agency_id)
      )
    )
  );
$$;
revoke all on function public.agency_is_verified(uuid), public.client_is_verified(uuid), public.can_read_passport(text) from public, anon, authenticated;
grant execute on function public.agency_is_verified(uuid), public.client_is_verified(uuid), public.can_read_passport(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('client-passports','client-passports',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy "Client uploads private passport" on storage.objects for insert to authenticated with check (
  bucket_id = 'client-passports' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'client' and p.account_status = 'active')
);
create policy "Authorized passport readers" on storage.objects for select to authenticated using (
  bucket_id = 'client-passports' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.can_read_passport(name)
  )
);

create function public.submit_client_profile(p_first_name text,p_last_name text,p_phone text,p_email text,p_passport_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if not exists(select 1 from public.profiles where id = uid and role = 'client' and account_status = 'active') then raise exception 'Accès client refusé' using errcode='42501'; end if;
  if p_first_name is null or p_last_name is null or p_phone is null or p_email is null or p_passport_path is null
    or char_length(trim(p_first_name)) not between 1 and 50 or char_length(trim(p_last_name)) not between 1 and 50
    or p_phone !~ '^\+?[0-9 ()-]{6,30}$' or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or lower(trim(p_email)) <> (select lower(email) from auth.users where id = uid)
    then raise exception 'Renseignez nom, prénom, téléphone et votre e-mail de connexion.'; end if;
  if (storage.foldername(p_passport_path))[1] <> uid::text or not exists(select 1 from storage.objects where bucket_id='client-passports' and name=p_passport_path) then raise exception 'Téléversez votre passeport dans votre espace privé.'; end if;
  update public.client_verifications set first_name=trim(p_first_name),last_name=trim(p_last_name),phone=trim(p_phone),contact_email=lower(trim(p_email)),passport_path=p_passport_path,status='pending',submitted_at=now(),reviewed_at=null,reviewed_by=null where client_id=uid;
  update public.passport_access set granted_path=null, granted_at=null where conversation_id in (select id from public.conversations where client_id=uid);
  update public.customer_profiles set full_name=left(trim(p_first_name)||' '||trim(p_last_name),100) where id=uid;
end $$;

create function public.list_verified_agencies() returns table(id uuid,name text)
language sql stable security definer set search_path = '' as $$
 select p.id,coalesce(s.display_name,a.business_name) from public.profiles p join public.agency_requests a on a.profile_id=p.id left join public.agency_profiles s on s.id=p.id where public.agency_is_verified(p.id);
$$;
create policy "Clients see published verified vehicles" on public.vehicles for select to authenticated
 using (active and public.agency_is_verified(agency_id) and exists(select 1 from public.profiles where id=auth.uid() and role='client' and account_status='active'));
create policy "Admin reads agency shop" on public.agency_profiles for select to authenticated using (public.is_admin());

create function public.start_conversation(p_agency_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='client' and account_status='active') or not public.agency_is_verified(p_agency_id) then raise exception 'Contact réservé aux clients actifs et aux agences vérifiées.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_agency_id::text,0));
 select id into cid from public.conversations where client_id=auth.uid() and agency_id=p_agency_id and status='active' order by created_at limit 1;
 if cid is null then insert into public.conversations(client_id,agency_id) values(auth.uid(),p_agency_id) returning id into cid; end if;
 return cid;
end $$;
create function public.check_conversation_access(p_conversation_id uuid) returns public.conversations
language plpgsql stable security definer set search_path = '' as $$
declare c public.conversations;
begin
 select * into c from public.conversations where id=p_conversation_id;
 if c.id is null or auth.uid() is null or auth.uid() not in(c.client_id,c.agency_id) or c.status <> 'active'
 or not public.agency_is_verified(c.agency_id) or not exists(select 1 from public.profiles where id=c.client_id and account_status='active')
 then raise exception 'Conversation inaccessible.' using errcode='42501'; end if;
 return c;
end $$;
create function public.send_conversation_message(p_conversation_id uuid,p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform public.check_conversation_access(p_conversation_id);
 if p_body is null or char_length(trim(p_body)) not between 1 and 10000 then raise exception 'Message vide ou trop long.'; end if;
 insert into public.conversation_messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),trim(p_body));
end $$;
create function public.conversation_client_status(p_conversation_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare c public.conversations;
begin
 c := public.check_conversation_access(p_conversation_id);
 return case when public.client_is_verified(c.client_id) then 'verified' else 'pending' end;
end $$;
create function public.request_passport_review(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversations;
begin
 c := public.check_conversation_access(p_conversation_id);
 if c.agency_id <> auth.uid() then raise exception 'Accès agence refusé' using errcode='42501'; end if;
 insert into public.passport_access(conversation_id) values(c.id) on conflict do nothing;
 insert into public.conversation_messages(conversation_id,sender_id,body) values(c.id,auth.uid(),'Merci de compléter votre profil et d’autoriser la consultation privée de votre passeport pour vérification.');
end $$;
create function public.authorize_passport_review(p_conversation_id uuid,p_allow boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.conversations; path text;
begin
 c := public.check_conversation_access(p_conversation_id);
 if c.client_id <> auth.uid() then raise exception 'Accès client refusé' using errcode='42501'; end if;
 select passport_path into path from public.client_verifications where client_id=c.client_id for update;
 if p_allow and path is null then raise exception 'Complétez votre profil et téléversez votre passeport.'; end if;
 update public.passport_access set granted_path=case when p_allow then path else null end,granted_at=case when p_allow then now() else null end where conversation_id=c.id;
 if not found then raise exception 'Aucune demande de vérification dans cette conversation.'; end if;
end $$;
create function public.verify_client_passport(p_client_id uuid,p_expected_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.client_verifications;
begin
 select * into v from public.client_verifications where client_id=p_client_id for update;
 if v.client_id is null or v.passport_path is null or v.submitted_at is null or p_expected_path is distinct from v.passport_path then raise exception 'Dossier incomplet ou modifié. Actualisez.'; end if;
 if not public.is_admin() and not (auth.uid() <> p_client_id and public.can_read_passport(v.passport_path)) then raise exception 'Consultation du passeport non autorisée' using errcode='42501'; end if;
 update public.client_verifications set status='verified',reviewed_at=now(),reviewed_by=auth.uid() where client_id=p_client_id;
 insert into public.admin_audit_logs(admin_id,admin_email,action,entity_type,entity_id,before_data,after_data)
 values(auth.uid(),(select email from auth.users where id=auth.uid()),'client.verified','client_verifications',p_client_id,jsonb_build_object('status',v.status),jsonb_build_object('status','verified'));
end $$;

create function public.create_client_reservation(p_vehicle_id uuid,p_start_date date,p_end_date date,p_request_id uuid) returns public.reservations
language plpgsql security definer set search_path = '' as $$
declare v public.vehicles; r public.reservations;
begin
 if not public.client_is_verified(auth.uid()) then raise exception 'Faites vérifier votre profil et votre passeport avant de réserver.' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Identifiant de demande manquant.'; end if;
 select * into v from public.vehicles where id=p_vehicle_id for update;
 if v.id is null or not v.active or v.availability <> 'available' or not public.agency_is_verified(v.agency_id) or v.daily_price_cents <= 0 then raise exception 'Véhicule indisponible.'; end if;
 select * into r from public.reservations where id=p_request_id;
 if r.id is not null then
   if r.client_id=auth.uid() and r.vehicle_id=p_vehicle_id and r.start_date=p_start_date and r.end_date=p_end_date then return r; end if;
   raise exception 'Demande déjà utilisée.';
 end if;
 if p_start_date is null or p_end_date is null or p_start_date < (now() at time zone 'Africa/Algiers')::date or p_end_date<=p_start_date or p_end_date-p_start_date>90 then raise exception 'Choisissez une période future de 1 à 90 jours.'; end if;
 if exists(select 1 from public.reservations where vehicle_id=v.id and status <> 'cancelled' and start_date<p_end_date and end_date>p_start_date) then raise exception 'Ce véhicule est déjà réservé pour ces dates.'; end if;
 insert into public.reservations(id,client_id,agency_id,vehicle_id,start_date,end_date,total_cents,status)
 values(p_request_id,auth.uid(),v.agency_id,v.id,p_start_date,p_end_date,v.daily_price_cents*(p_end_date-p_start_date),'confirmed') returning * into r;
 return r;
end $$;

revoke all on function public.submit_client_profile(text,text,text,text,text),public.list_verified_agencies(),public.start_conversation(uuid),public.check_conversation_access(uuid),public.send_conversation_message(uuid,text),public.conversation_client_status(uuid),public.request_passport_review(uuid),public.authorize_passport_review(uuid,boolean),public.verify_client_passport(uuid,text),public.create_client_reservation(uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function public.submit_client_profile(text,text,text,text,text),public.list_verified_agencies(),public.start_conversation(uuid),public.send_conversation_message(uuid,text),public.conversation_client_status(uuid),public.request_passport_review(uuid),public.authorize_passport_review(uuid,boolean),public.verify_client_passport(uuid,text),public.create_client_reservation(uuid,date,date,uuid) to authenticated;
commit;
