begin;

-- Keep the complete business change, including server-side corrections to dates
-- and payment references. Technical update timestamps do not create noise.
create or replace function public.audit_admin_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_values jsonb; new_values jsonb; action_name text;
begin
  old_values = to_jsonb(old) - 'created_at' - 'updated_at';
  new_values = to_jsonb(new) - 'created_at' - 'updated_at';
  if tg_table_name = 'agency_requests' then
    action_name = 'agency.' || new.status;
  elsif tg_table_name = 'reservations' then
    action_name = 'reservation.updated';
  else
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

commit;
