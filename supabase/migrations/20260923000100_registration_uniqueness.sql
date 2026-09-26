begin;

-- Keep the original RC for display; compare a canonical form for uniqueness.
create function public.normalize_rc_number(value text)
returns text language sql immutable strict parallel safe
set search_path = ''
as $$ select regexp_replace(upper(normalize(value, NFKC)), '[^[:alnum:]]', '', 'g') $$;

-- Existing collisions need a human decision. Never rewrite or delete dossiers.
do $$
begin
  if exists (
    select 1 from public.agency_requests
    group by public.normalize_rc_number(rc_number) having count(*) > 1
  ) then
    raise exception 'Existing agency requests have duplicate normalized RC numbers. Resolve the conflicting dossiers before retrying this migration.';
  end if;
end $$;

create unique index agency_requests_rc_normalized_key
on public.agency_requests (public.normalize_rc_number(rc_number));

-- NOT VALID preserves legacy data, while checking every new or changed row.
alter table public.agency_requests add constraint agency_requests_rc_normalized_length
check (length(public.normalize_rc_number(rc_number)) between 2 and 80) not valid;

-- One submission per authenticated profile, including retries and corrections.
-- No caller-supplied profile, approval, or review fields are accepted.
create function public.submit_agency_request(p_business_name text, p_rc_number text, p_document_path text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  request_id uuid;
begin
  if owner_id is null or not exists (
    select 1 from public.profiles where id = owner_id and role = 'agency' and account_status = 'active'
  ) then
    raise exception 'Agency access required' using errcode = '42501';
  end if;
  if (storage.foldername(p_document_path))[1] is distinct from owner_id::text
    or not exists (select 1 from storage.objects where bucket_id = 'agency-documents' and name = p_document_path)
  then
    raise exception 'Own uploaded document required' using errcode = '42501';
  end if;

  insert into public.agency_requests as existing (profile_id, business_name, rc_number, document_path)
  values (owner_id, btrim(p_business_name), btrim(p_rc_number), p_document_path)
  on conflict (profile_id) do update set
    business_name = excluded.business_name,
    rc_number = excluded.rc_number,
    document_path = excluded.document_path,
    status = 'pending', admin_note = null, reviewed_at = null
  -- A replay must not erase an admin decision or generate an audit event.
  where (existing.business_name, existing.rc_number, existing.document_path)
    is distinct from (excluded.business_name, excluded.rc_number, excluded.document_path)
  returning id into request_id;

  if request_id is null then
    select id into request_id from public.agency_requests where profile_id = owner_id;
  end if;
  return request_id;
end $$;
revoke all on function public.submit_agency_request(text, text, text) from public, anon;
grant execute on function public.submit_agency_request(text, text, text) to authenticated;

commit;
