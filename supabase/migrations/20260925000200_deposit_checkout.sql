begin;

-- Synchronised from Supabase Cloud (applied 2026-09-25, previously missing from Git).
-- Chargily deposit checkout: service-only functions called by the Edge Function.
create table public.deposit_checkouts (
 reservation_id uuid primary key references public.reservations(id),
 attempt_id uuid not null unique default gen_random_uuid(),
 checkout_id text unique,
 checkout_url text,
 state text not null default 'creating' check(state in ('creating','pending','paid','failed')),
 created_at timestamptz not null default now()
);
alter table public.deposit_checkouts enable row level security;
revoke all on public.deposit_checkouts from public,anon,authenticated;

-- Service-only functions: authentication is checked by the Edge function using Auth.getUser.
create function public.prepare_deposit_checkout(p_reservation_id uuid,p_client_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.reservations; c public.deposit_checkouts;
begin
 select * into r from public.reservations where id=p_reservation_id for update;
 if r.id is null or r.client_id<>p_client_id or not public.client_is_verified(p_client_id) or not public.agency_is_verified(r.agency_id) then raise exception 'Profil non vérifié ou réservation inaccessible.' using errcode='42501'; end if;
 if r.status <> 'confirmed' or exists(select 1 from public.payments where reservation_id=r.id and kind='deposit' and status in('confirmed','refunded')) then raise exception 'Cette réservation ne peut pas recevoir un nouvel acompte.'; end if;
 if r.deposit_cents < 10000 or r.deposit_cents % 100 <> 0 then raise exception 'Cet acompte exact de 10 %% n’est pas compatible avec le paiement en ligne (minimum 100 DZD, montant entier). Contactez le support.'; end if;
 select * into c from public.deposit_checkouts where reservation_id=r.id;
 if c.reservation_id is not null then
   if c.state='pending' and c.checkout_url is not null then return jsonb_build_object('checkout_url',c.checkout_url); end if;
   raise exception 'Un paiement est déjà en cours de traitement. Actualisez ou contactez le support avant de réessayer.';
 end if;
 insert into public.deposit_checkouts(reservation_id) values(r.id) returning * into c;
 return jsonb_build_object('attempt_id',c.attempt_id,'amount',r.deposit_cents/100,'reference',r.reference);
end $$;
create function public.attach_deposit_checkout(p_attempt_id uuid,p_checkout_id text,p_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.deposit_checkouts; r public.reservations;
begin
 select * into c from public.deposit_checkouts where attempt_id=p_attempt_id for update;
 if c.reservation_id is null or (c.checkout_id is not null and c.checkout_id<>p_checkout_id) then raise exception 'Paiement inconnu ou incohérent'; end if;
 select * into r from public.reservations where id=c.reservation_id for update;
 update public.deposit_checkouts set checkout_id=p_checkout_id,checkout_url=p_url,state=case when state='creating' then 'pending' else state end where attempt_id=p_attempt_id;
 insert into public.payments(reservation_id,kind,source,chargily_reference,amount_cents) values(r.id,'deposit','chargily',p_checkout_id,r.deposit_cents) on conflict(chargily_reference) do nothing;
end $$;
create function public.confirm_deposit_checkout(p_checkout_id text,p_amount_dzd bigint,p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.deposit_checkouts; r public.reservations;
begin
 select * into c from public.deposit_checkouts where checkout_id=p_checkout_id for update;
 if c.reservation_id is null then raise exception 'Paiement non encore enregistré. Réessayer.'; end if;
 select * into r from public.reservations where id=c.reservation_id for update;
 if p_currency is distinct from 'dzd' or p_amount_dzd is null or p_amount_dzd*100<>r.deposit_cents then raise exception 'Montant ou devise incohérent'; end if;
 if c.state='paid' then return; end if;
 -- Always record real money even if a subsequent admin action cancelled the booking.
 update public.payments set status='confirmed',confirmed_at=now(),commission_cents=r.commission_cents where chargily_reference=p_checkout_id and status='pending';
 if not found then raise exception 'Paiement incohérent'; end if;
 update public.deposit_checkouts set state='paid' where checkout_id=p_checkout_id;
 if r.status='confirmed' then update public.reservations set status='deposit_paid' where id=r.id; end if;
end $$;
revoke all on function public.prepare_deposit_checkout(uuid,uuid),public.attach_deposit_checkout(uuid,text,text),public.confirm_deposit_checkout(text,bigint,text) from public,anon,authenticated;
grant execute on function public.prepare_deposit_checkout(uuid,uuid),public.attach_deposit_checkout(uuid,text,text),public.confirm_deposit_checkout(text,bigint,text) to service_role;

commit;
