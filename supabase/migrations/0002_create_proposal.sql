-- =====================================================================
-- 0002 — RPC create_proposal
-- Crea una propuesta hasheando el código presencial en el servidor
-- (bcrypt) y enlaza los centros destino, en una sola transacción.
-- =====================================================================
create or replace function public.create_proposal(
  p_title       text,
  p_description text,
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_requires_code boolean,
  p_code        text,
  p_center_ids  uuid[]
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_id uuid;
  c uuid;
begin
  if public.current_user_role() not in ('organizer','admin') then
    raise exception 'Solo organizadores o administradores pueden crear propuestas';
  end if;
  if p_requires_code and (p_code is null or length(trim(p_code)) = 0) then
    raise exception 'Falta el código presencial';
  end if;
  if coalesce(array_length(p_center_ids, 1), 0) = 0 then
    raise exception 'Selecciona al menos un centro';
  end if;

  insert into public.proposals (
    title, description, created_by, starts_at, ends_at,
    requires_presence_code, verbal_code_hash, status
  ) values (
    p_title, p_description, auth.uid(), p_starts_at, p_ends_at,
    p_requires_code,
    case when p_requires_code
         then extensions.crypt(p_code, extensions.gen_salt('bf'))
         else null end,
    'active'
  ) returning id into v_id;

  foreach c in array p_center_ids loop
    insert into public.proposal_work_centers (proposal_id, work_center_id)
    values (v_id, c);
  end loop;

  return v_id;
end $$;

revoke execute on function
  public.create_proposal(text,text,timestamptz,timestamptz,boolean,text,uuid[])
  from public, anon;
grant execute on function
  public.create_proposal(text,text,timestamptz,timestamptz,boolean,text,uuid[])
  to authenticated;
