begin;

alter table public.profiles add column account_status text not null default 'active' check (account_status in ('active', 'suspended'));

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.profiles(id),
  brand text not null check (char_length(brand) between 1 and 80),
  model text not null check (char_length(model) between 1 and 100),
  category text not null check (category in ('city', 'compact', 'sedan', 'suv', 'utility', 'luxury')),
  year integer check (year between 1950 and 2200),
  daily_price_cents bigint not null check (daily_price_cents between 0 and 9000000000000),
  currency text not null default 'DZD' check (currency = 'DZD'),
  active boolean not null default true,
  availability text not null default 'available' check (availability in ('available','rented','maintenance')),
  photos text[] not null default '{}',
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (id, agency_id)
);
create index vehicles_agency_idx on public.vehicles(agency_id);
create index vehicles_filters_idx on public.vehicles(active, category, availability);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SB-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  client_id uuid not null references public.profiles(id),
  agency_id uuid not null references public.profiles(id),
  vehicle_id uuid not null,
  start_date date not null,
  end_date date not null check (end_date > start_date),
  total_cents bigint not null check (total_cents between 0 and 9000000000000),
  deposit_cents bigint generated always as (round(total_cents::numeric / 10)::bigint) stored,
  commission_cents bigint generated always as (round(total_cents::numeric / 10)::bigint) stored,
  currency text not null default 'DZD' check (currency = 'DZD'),
  status text not null default 'request' check (status in ('request','confirmed','deposit_paid','delivered','completed','cancelled')),
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, agency_id) references public.vehicles(id, agency_id)
);
create index reservations_client_idx on public.reservations(client_id, created_at desc);
create index reservations_agency_idx on public.reservations(agency_id, created_at desc);
create index reservations_vehicle_dates_idx on public.reservations(vehicle_id, start_date, end_date);
create index reservations_status_period_idx on public.reservations(status, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  kind text not null check (kind in ('deposit','balance')),
  source text not null check (source in ('chargily','manual')),
  chargily_reference text unique,
  amount_cents bigint not null check (amount_cents between 1 and 9000000000000),
  commission_cents bigint not null default 0 check (commission_cents >= 0 and commission_cents <= amount_cents),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  refunded_commission_cents bigint not null default 0 check (refunded_commission_cents >= 0 and refunded_commission_cents <= commission_cents and refunded_commission_cents <= refunded_cents),
  agency_transferred_cents bigint not null default 0 check (agency_transferred_cents >= 0 and agency_transferred_cents <= amount_cents - commission_cents),
  currency text not null default 'DZD' check (currency = 'DZD'),
  status text not null default 'pending' check (status in ('pending','confirmed','failed','refunded')),
  confirmed_at timestamptz,
  refunded_at timestamptz,
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source <> 'chargily' or chargily_reference is not null),
  check ((status in ('confirmed','refunded')) = (confirmed_at is not null)),
  check ((refunded_cents > 0) = (refunded_at is not null)),
  check (status in ('confirmed','refunded') or (refunded_cents = 0 and agency_transferred_cents = 0)),
  check (status <> 'refunded' or refunded_cents = amount_cents),
  check (refunded_cents - refunded_commission_cents <= amount_cents - commission_cents)
);
create index payments_reservation_idx on public.payments(reservation_id);
create index payments_status_date_idx on public.payments(status, confirmed_at);
create index payments_created_idx on public.payments(created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  agency_id uuid not null references public.profiles(id),
  reservation_id uuid references public.reservations(id),
  subject text not null default 'Échange client / agence' check (char_length(subject) between 1 and 180),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now()
);
create index conversations_client_idx on public.conversations(client_id);
create index conversations_agency_idx on public.conversations(agency_id);
create index conversations_reservation_idx on public.conversations(reservation_id);
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index conversation_messages_timeline_idx on public.conversation_messages(conversation_id, created_at);
create table public.conversation_admin_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, admin_id)
);
create index conversation_reads_admin_idx on public.conversation_admin_reads(admin_id);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_date_idx on public.admin_audit_logs(created_at desc);
create index admin_audit_logs_actor_idx on public.admin_audit_logs(admin_id);
create index admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id);

-- API grants are explicit. Browser accounts cannot create payments or invent amounts.
alter table public.vehicles enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_admin_reads enable row level security;
alter table public.admin_audit_logs enable row level security;
revoke all on public.vehicles, public.reservations, public.payments, public.conversations, public.conversation_messages, public.conversation_admin_reads, public.admin_audit_logs from anon, authenticated;
grant select on public.vehicles, public.reservations, public.payments, public.conversations, public.conversation_messages, public.conversation_admin_reads, public.admin_audit_logs to authenticated;
create policy "Vehicles owner or admin" on public.vehicles for select to authenticated using (agency_id = (select auth.uid()) or (select public.is_admin()));
create policy "Reservations participants or admin" on public.reservations for select to authenticated using (client_id = (select auth.uid()) or agency_id = (select auth.uid()) or (select public.is_admin()));
create policy "Payments participants or admin" on public.payments for select to authenticated using ((select public.is_admin()) or exists (select 1 from public.reservations r where r.id = reservation_id and (r.client_id = (select auth.uid()) or r.agency_id = (select auth.uid()))));
create policy "Conversations participants or admin" on public.conversations for select to authenticated using (client_id = (select auth.uid()) or agency_id = (select auth.uid()) or (select public.is_admin()));
create policy "Messages participants or admin" on public.conversation_messages for select to authenticated using ((select public.is_admin()) or exists (select 1 from public.conversations c where c.id = conversation_id and (c.client_id = (select auth.uid()) or c.agency_id = (select auth.uid()))));
create policy "Admin own read receipts" on public.conversation_admin_reads for select to authenticated using (admin_id = (select auth.uid()) and (select public.is_admin()));
create policy "Admin reads audit" on public.admin_audit_logs for select to authenticated using ((select public.is_admin()));

-- Validate ownership and allocation at the database boundary, including trusted imports.
create function public.validate_platform_record() returns trigger language plpgsql set search_path = '' as $$
declare r public.reservations; c public.conversations;
begin
  if tg_table_name in ('vehicles','reservations','conversations') then
    if not exists (select 1 from public.profiles where id = new.agency_id and role = 'agency') then raise exception 'Agence invalide'; end if;
  end if;
  if tg_table_name in ('reservations','conversations') then
    if not exists (select 1 from public.profiles where id = new.client_id and role = 'client') then raise exception 'Client invalide'; end if;
  end if;
  if tg_table_name = 'conversations' then
   if new.reservation_id is not null then
    select * into r from public.reservations where id = new.reservation_id;
    if r.client_id <> new.client_id or r.agency_id <> new.agency_id then raise exception 'Participants incohérents'; end if;
   end if;
  end if;
  if tg_table_name = 'conversation_messages' then
    select * into c from public.conversations where id = new.conversation_id;
    if new.sender_id not in (c.client_id, c.agency_id) then raise exception 'Expéditeur invalide'; end if;
  end if;
  if tg_table_name = 'payments' then
    select * into r from public.reservations where id = new.reservation_id for update;
    if new.status in ('confirmed','refunded') then
      if new.amount_cents + coalesce((select sum(amount_cents) from public.payments where reservation_id = new.reservation_id and id <> new.id and status in ('confirmed','refunded')), 0) > r.total_cents then raise exception 'Paiements supérieurs au prix total'; end if;
      if new.commission_cents + coalesce((select sum(commission_cents) from public.payments where reservation_id = new.reservation_id and id <> new.id and status in ('confirmed','refunded')), 0) > r.commission_cents then raise exception 'Commission supérieure à 10 pour cent'; end if;
    end if;
    new.updated_at = now();
  end if;
  if tg_table_name = 'reservations' then new.updated_at = now(); end if;
  return new;
end;
$$;
revoke all on function public.validate_platform_record() from public, anon, authenticated;
create trigger validate_vehicle before insert or update on public.vehicles for each row execute function public.validate_platform_record();
create trigger validate_reservation before insert or update on public.reservations for each row execute function public.validate_platform_record();
create trigger validate_payment before insert or update on public.payments for each row execute function public.validate_platform_record();
create trigger validate_conversation before insert or update on public.conversations for each row execute function public.validate_platform_record();
create trigger validate_message before insert or update on public.conversation_messages for each row execute function public.validate_platform_record();

-- Audit the actual transaction in PostgreSQL, not a browser-supplied log entry.
create function public.audit_admin_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_values jsonb; new_values jsonb; action_name text;
begin
  if tg_table_name = 'agency_requests' then
    old_values = jsonb_build_object('status',old.status,'admin_note',old.admin_note);
    new_values = jsonb_build_object('status',new.status,'admin_note',new.admin_note);
    action_name = 'agency.' || new.status;
  elsif tg_table_name = 'reservations' then
    old_values = jsonb_build_object('status',old.status,'total_cents',old.total_cents,'admin_note',old.admin_note);
    new_values = jsonb_build_object('status',new.status,'total_cents',new.total_cents,'admin_note',new.admin_note);
    action_name = 'reservation.updated';
  else
    old_values = jsonb_build_object('status',old.status,'amount_cents',old.amount_cents,'commission_cents',old.commission_cents,'refunded_cents',old.refunded_cents,'refunded_commission_cents',old.refunded_commission_cents,'agency_transferred_cents',old.agency_transferred_cents,'admin_note',old.admin_note);
    new_values = jsonb_build_object('status',new.status,'amount_cents',new.amount_cents,'commission_cents',new.commission_cents,'refunded_cents',new.refunded_cents,'refunded_commission_cents',new.refunded_commission_cents,'agency_transferred_cents',new.agency_transferred_cents,'admin_note',new.admin_note);
    action_name = 'payment.updated';
  end if;
  if old_values is distinct from new_values then
    insert into public.admin_audit_logs(admin_id, admin_email, action, entity_type, entity_id, before_data, after_data)
    values ((select auth.uid()), (select email from auth.users where id = (select auth.uid())), action_name, tg_table_name, new.id, old_values, new_values);
  end if;
  return new;
end;
$$;
revoke all on function public.audit_admin_change() from public, anon, authenticated;
create trigger audit_agency after update on public.agency_requests for each row execute function public.audit_admin_change();
create trigger audit_reservation after update on public.reservations for each row execute function public.audit_admin_change();
create trigger audit_payment after update on public.payments for each row execute function public.audit_admin_change();

create function public.admin_review_agency(request_id uuid, expected_status text, decision text, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode='42501'; end if;
  if decision not in ('approved','rejected','needs_changes') then raise exception 'Décision invalide'; end if;
  if char_length(note) > 2000 or (decision in ('rejected','needs_changes') and char_length(trim(note)) < 3) then raise exception 'Précisez le motif (3 à 2000 caractères)'; end if;
  update public.agency_requests set status = decision, admin_note = nullif(trim(note), ''), reviewed_at = now() where id = request_id and status = expected_status;
  if not found then raise exception 'Demande modifiée. Actualisez la page.'; end if;
end;
$$;

create function public.admin_update_reservation(reservation_id uuid, expected_status text, next_status text, note text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reservations;
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode='42501'; end if;
  select * into r from public.reservations where id = reservation_id for update;
  if not found or r.status <> expected_status then raise exception 'Réservation modifiée. Actualisez la page.'; end if;
  if char_length(note) > 2000 then raise exception 'Note trop longue'; end if;
  if next_status <> r.status and not (
    (r.status = 'request' and next_status in ('confirmed','cancelled')) or
    (r.status = 'confirmed' and next_status in ('deposit_paid','cancelled')) or
    (r.status = 'deposit_paid' and next_status in ('delivered','cancelled')) or
    (r.status = 'delivered' and next_status = 'completed')
  ) then raise exception 'Transition de statut interdite'; end if;
  if next_status = 'deposit_paid' and coalesce((select sum(amount_cents-refunded_cents) from public.payments p where p.reservation_id = r.id and p.kind='deposit' and p.status in ('confirmed','refunded')),0) < r.deposit_cents then raise exception 'Aucun acompte confirmé suffisant'; end if;
  update public.reservations set status = next_status, admin_note = trim(note) where id = r.id;
end;
$$;

create function public.admin_note_payment(payment_id uuid, expected_updated_at timestamptz, note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode='42501'; end if;
  if char_length(note) > 2000 then raise exception 'Note trop longue'; end if;
  update public.payments set admin_note = trim(note) where id = payment_id and updated_at = expected_updated_at;
  if not found then raise exception 'Paiement modifié. Actualisez la page.'; end if;
end;
$$;
create function public.admin_read_conversation(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode='42501'; end if;
  insert into public.conversation_admin_reads(conversation_id, admin_id, last_read_at) values (target_id, (select auth.uid()), now())
  on conflict (conversation_id, admin_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function public.admin_review_agency(uuid,text,text,text), public.admin_update_reservation(uuid,text,text,text), public.admin_note_payment(uuid,timestamptz,text), public.admin_read_conversation(uuid) from public, anon, authenticated;
grant execute on function public.admin_review_agency(uuid,text,text,text), public.admin_update_reservation(uuid,text,text,text), public.admin_note_payment(uuid,timestamptz,text), public.admin_read_conversation(uuid) to authenticated;
-- Route reviews through the audited RPC (existing signup remains unchanged).
revoke update on public.agency_requests from authenticated;
revoke update (status, admin_note, reviewed_at) on public.agency_requests from authenticated;
commit;
