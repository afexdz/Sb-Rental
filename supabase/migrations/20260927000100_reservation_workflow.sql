begin;

-- Reservation workflow: the client sends a request, the verified agency accepts
-- or refuses it, and every status change is kept in a history table.
-- Additive: existing reservations, payments and statuses are retained.

-- 1. New "rejected" status (widening the existing check only).
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check
  check (status in ('request','confirmed','rejected','deposit_paid','delivered','completed','cancelled'));

-- Reason shown to the client and the agency (refusal, cancellation).
alter table public.reservations add column if not exists status_note text not null default ''
  check (char_length(status_note) <= 500);

-- 2. Complete history of status changes.
create table public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('client','agency','admin','system')),
  from_status text,
  to_status text not null,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index reservation_events_timeline_idx on public.reservation_events(reservation_id, created_at);
alter table public.reservation_events enable row level security;
revoke all on public.reservation_events from anon, authenticated;
grant select on public.reservation_events to authenticated;
create policy "Reservation events participants or admin" on public.reservation_events for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.reservations r where r.id = reservation_id
      and (r.client_id = (select auth.uid()) or r.agency_id = (select auth.uid()))
  ));

create function public.log_reservation_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_kind text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if actor is null then actor_kind := 'system';
  elsif public.is_admin() then actor_kind := 'admin';
  else select coalesce(role, 'system') into actor_kind from public.profiles where id = actor;
  end if;
  insert into public.reservation_events(reservation_id, actor_id, actor_role, from_status, to_status, note)
  values (new.id, actor, coalesce(actor_kind, 'system'), case when tg_op = 'UPDATE' then old.status end, new.status,
          case when actor_kind = 'admin' then '' else new.status_note end);
  return new;
end $$;
revoke all on function public.log_reservation_event() from public, anon, authenticated;
create trigger reservation_events_log after insert or update of status on public.reservations
  for each row execute function public.log_reservation_event();

-- History for reservations created before this migration.
insert into public.reservation_events(reservation_id, actor_role, from_status, to_status, created_at)
select id, 'system', null, status, created_at from public.reservations;

-- Speeds up overlap checks on active reservations.
create index if not exists reservations_active_period_idx on public.reservations(vehicle_id, start_date, end_date)
  where status in ('request','confirmed','deposit_paid','delivered');

-- 3. Client request: now created as "request" and confirmed by the agency.
create or replace function public.create_client_reservation(p_vehicle_id uuid, p_start_date date, p_end_date date, p_request_id uuid)
returns public.reservations
language plpgsql security definer set search_path = '' as $$
declare v public.vehicles; r public.reservations; today date := (now() at time zone 'Africa/Algiers')::date;
begin
  if not public.client_is_verified(auth.uid()) then raise exception 'Faites vérifier votre profil et votre passeport avant de réserver.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Identifiant de demande manquant.'; end if;
  select * into v from public.vehicles where id = p_vehicle_id for update;
  if v.id is null or not v.active or v.availability <> 'available' or not public.agency_is_verified(v.agency_id) or v.daily_price_cents <= 0 then raise exception 'Véhicule indisponible.'; end if;
  select * into r from public.reservations where id = p_request_id;
  if r.id is not null then
    if r.client_id = auth.uid() and r.vehicle_id = p_vehicle_id and r.start_date = p_start_date and r.end_date = p_end_date then return r; end if;
    raise exception 'Demande déjà utilisée.';
  end if;
  if p_start_date is null or p_end_date is null or p_start_date < today or p_end_date <= p_start_date or p_end_date - p_start_date > 90 then
    raise exception 'Choisissez une période future de 1 à 90 jours.';
  end if;
  if exists (select 1 from public.reservations where vehicle_id = v.id and status in ('confirmed','deposit_paid','delivered') and start_date < p_end_date and end_date > p_start_date) then
    raise exception 'Ce véhicule est déjà réservé pour ces dates.';
  end if;
  if exists (select 1 from public.reservations where vehicle_id = v.id and client_id = auth.uid() and status = 'request' and start_date < p_end_date and end_date > p_start_date) then
    raise exception 'Vous avez déjà une demande en cours pour ce véhicule à ces dates.';
  end if;
  insert into public.reservations(id, client_id, agency_id, vehicle_id, start_date, end_date, total_cents, status)
  values (p_request_id, auth.uid(), v.agency_id, v.id, p_start_date, p_end_date, v.daily_price_cents * (p_end_date - p_start_date), 'request')
  returning * into r;
  return r;
end $$;

-- 4. Agency accepts or refuses a request.
create function public.agency_respond_reservation(p_reservation_id uuid, p_decision text, p_note text default '')
returns public.reservations
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; v public.vehicles; note text := trim(coalesce(p_note, '')); today date := (now() at time zone 'Africa/Algiers')::date;
begin
  if not public.agency_is_verified(auth.uid()) then raise exception 'Votre agence doit être approuvée.' using errcode = '42501'; end if;
  if p_decision not in ('confirmed','rejected') then raise exception 'Décision invalide.'; end if;
  if char_length(note) > 500 then raise exception 'Motif trop long (500 caractères maximum).'; end if;
  select * into r from public.reservations where id = p_reservation_id and agency_id = auth.uid();
  if r.id is null then raise exception 'Réservation introuvable.'; end if;
  -- Lock the vehicle first, like client requests, so decisions are serialized.
  select * into v from public.vehicles where id = r.vehicle_id for update;
  select * into r from public.reservations where id = p_reservation_id for update;
  if r.status <> 'request' then raise exception 'Cette demande a déjà été traitée. Actualisez la page.'; end if;
  if p_decision = 'rejected' then
    if char_length(note) < 3 then raise exception 'Indiquez le motif du refus.'; end if;
    update public.reservations set status = 'rejected', status_note = note where id = r.id returning * into r;
    return r;
  end if;
  if r.start_date < today then raise exception 'La date de début est passée : refusez cette demande.'; end if;
  if not public.client_is_verified(r.client_id) then raise exception 'Le client doit être vérifié avant la confirmation.'; end if;
  if not v.active or v.availability <> 'available' then raise exception 'Ce véhicule n’est plus disponible.'; end if;
  if exists (select 1 from public.reservations where vehicle_id = r.vehicle_id and id <> r.id and status in ('confirmed','deposit_paid','delivered') and start_date < r.end_date and end_date > r.start_date) then
    raise exception 'Ce véhicule est déjà réservé pour ces dates.';
  end if;
  update public.reservations set status = 'confirmed', status_note = note where id = r.id returning * into r;
  -- Other requests on the same dates can no longer be honoured.
  update public.reservations set status = 'rejected', status_note = 'Véhicule réservé par un autre client pour ces dates.'
   where vehicle_id = r.vehicle_id and id <> r.id and status = 'request' and start_date < r.end_date and end_date > r.start_date;
  return r;
end $$;

-- 5. Cancellation: client or agency, before the start date only.
create function public.cancel_reservation(p_reservation_id uuid, p_note text default '')
returns public.reservations
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; note text := trim(coalesce(p_note, '')); today date := (now() at time zone 'Africa/Algiers')::date;
begin
  if char_length(note) > 500 then raise exception 'Motif trop long (500 caractères maximum).'; end if;
  select * into r from public.reservations where id = p_reservation_id and (client_id = auth.uid() or agency_id = auth.uid()) for update;
  if r.id is null then raise exception 'Réservation introuvable.'; end if;
  if r.status not in ('request','confirmed') then raise exception 'Cette réservation ne peut plus être annulée en ligne. Contactez notre équipe.'; end if;
  if r.status = 'confirmed' and r.start_date <= today then raise exception 'La location a commencé : l’annulation n’est plus possible en ligne.'; end if;
  if r.agency_id = auth.uid() and char_length(note) < 3 then raise exception 'Indiquez le motif de l’annulation.'; end if;
  update public.reservations set status = 'cancelled', status_note = note where id = r.id returning * into r;
  return r;
end $$;

-- 6. Agency closes a rental once it has started.
create function public.agency_complete_reservation(p_reservation_id uuid)
returns public.reservations
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; today date := (now() at time zone 'Africa/Algiers')::date;
begin
  if not public.agency_is_verified(auth.uid()) then raise exception 'Votre agence doit être approuvée.' using errcode = '42501'; end if;
  select * into r from public.reservations where id = p_reservation_id and agency_id = auth.uid() for update;
  if r.id is null then raise exception 'Réservation introuvable.'; end if;
  if r.status not in ('confirmed','deposit_paid','delivered') then raise exception 'Seule une location confirmée peut être terminée.'; end if;
  if r.start_date > today then raise exception 'La location n’a pas encore commencé.'; end if;
  update public.reservations set status = 'completed', status_note = '' where id = r.id returning * into r;
  return r;
end $$;

-- 7. Lists with names the browser cannot read directly under RLS.
create function public.agency_list_reservations()
returns table (id uuid, reference text, status text, status_note text, start_date date, end_date date, total_cents bigint, deposit_cents bigint,
               created_at timestamptz, vehicle_label text, client_name text, client_phone text, client_verified boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reference, r.status, r.status_note, r.start_date, r.end_date, r.total_cents, r.deposit_cents, r.created_at,
         trim(v.brand || ' ' || v.model),
         coalesce(nullif(trim(cv.first_name || ' ' || cv.last_name), ''), nullif(p.full_name, ''), 'Client'),
         case when r.status in ('confirmed','deposit_paid','delivered','completed') then coalesce(cv.phone, '') else '' end,
         public.client_is_verified(r.client_id)
    from public.reservations r
    join public.vehicles v on v.id = r.vehicle_id
    join public.profiles p on p.id = r.client_id
    left join public.client_verifications cv on cv.client_id = r.client_id
   where r.agency_id = auth.uid() and public.agency_is_verified(auth.uid())
   order by r.created_at desc;
$$;

create function public.client_list_reservations()
returns table (id uuid, reference text, status text, status_note text, start_date date, end_date date, total_cents bigint, deposit_cents bigint,
               created_at timestamptz, vehicle_label text, agency_name text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.reference, r.status, r.status_note, r.start_date, r.end_date, r.total_cents, r.deposit_cents, r.created_at,
         trim(v.brand || ' ' || v.model), coalesce(s.display_name, a.business_name, 'Agence')
    from public.reservations r
    join public.vehicles v on v.id = r.vehicle_id
    left join public.agency_profiles s on s.id = r.agency_id
    left join public.agency_requests a on a.profile_id = r.agency_id
   where r.client_id = auth.uid()
   order by r.created_at desc;
$$;

-- 8. Admin transitions now include refusal and closing without online payment.
create or replace function public.admin_update_reservation(reservation_id uuid, expected_status text, next_status text, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into r from public.reservations where id = reservation_id for update;
  if not found or r.status <> expected_status then raise exception 'Réservation modifiée. Actualisez la page.'; end if;
  if char_length(note) > 2000 then raise exception 'Note trop longue'; end if;
  if next_status <> r.status and not (
    (r.status = 'request' and next_status in ('confirmed','rejected','cancelled')) or
    (r.status = 'confirmed' and next_status in ('deposit_paid','completed','cancelled')) or
    (r.status = 'deposit_paid' and next_status in ('delivered','cancelled')) or
    (r.status = 'delivered' and next_status = 'completed')
  ) then raise exception 'Transition de statut interdite'; end if;
  if next_status = 'confirmed' and exists (select 1 from public.reservations x where x.vehicle_id = r.vehicle_id and x.id <> r.id and x.status in ('confirmed','deposit_paid','delivered') and x.start_date < r.end_date and x.end_date > r.start_date) then
    raise exception 'Ce véhicule est déjà réservé pour ces dates.';
  end if;
  if next_status = 'deposit_paid' and coalesce((select sum(amount_cents - refunded_cents) from public.payments p where p.reservation_id = r.id and p.kind = 'deposit' and p.status in ('confirmed','refunded')), 0) < r.deposit_cents then
    raise exception 'Aucun acompte confirmé suffisant';
  end if;
  update public.reservations set status = next_status, admin_note = trim(note) where id = r.id;
end $$;

revoke all on function public.agency_respond_reservation(uuid, text, text), public.cancel_reservation(uuid, text), public.agency_complete_reservation(uuid),
  public.agency_list_reservations(), public.client_list_reservations() from public, anon, authenticated;
grant execute on function public.agency_respond_reservation(uuid, text, text), public.cancel_reservation(uuid, text), public.agency_complete_reservation(uuid),
  public.agency_list_reservations(), public.client_list_reservations() to authenticated;

commit;
