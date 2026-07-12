-- =====================================================================
-- 0003 — Emisión de la verificación de correo corporativo + unicidad
-- ---------------------------------------------------------------------
-- La CONFIRMACIÓN del código ya existe (confirm_corporate_verification, 0001).
-- Aquí se añade:
--   * Unicidad: un correo corporativo verificado = una sola cuenta.
--   * handle_new_user copia el corporativo (opcional) puesto en el registro.
--   * issue_corporate_verification: genera el código, lo guarda hasheado y
--     lo DEVUELVE en claro SOLO al service_role (la Edge Function que lo
--     envía por correo). Nunca es invocable desde el cliente.
--   * get_proposal_stats exige estar verificado (salvo organizador/admin).
-- =====================================================================

-- ---------- Unicidad del correo corporativo verificado ----------
-- Solo una cuenta puede tener un correo corporativo dado como verificado.
create unique index if not exists profiles_corporate_email_verified_uq
  on public.profiles (lower(corporate_email))
  where corporate_email_verified;

-- ---------- Registro: copia el corporativo opcional del metadata ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_corp text := nullif(trim(new.raw_user_meta_data->>'corporate_email'), '');
begin
  insert into public.profiles (id, full_name, corporate_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    lower(v_corp)
  );
  return new;
end $$;

-- ---------- Emisión del código de verificación ----------
-- Solo la Edge Function (service_role) puede ejecutarla: valida el dominio,
-- comprueba que el correo no esté verificado en otra cuenta, genera un código
-- de 6 dígitos, guarda su hash con caducidad e invalida los códigos previos.
-- Devuelve el código EN CLARO al llamante (service_role) para que lo envíe
-- por correo. El código nunca vuelve al navegador.
create or replace function public.issue_corporate_verification(
  p_profile_id uuid,
  p_email      text
) returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_code  text;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Perfil no encontrado';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Falta el correo corporativo';
  end if;

  if not public.is_allowed_domain(v_email) then
    raise exception 'El dominio del correo corporativo no está admitido';
  end if;

  -- No se puede reclamar un corporativo ya verificado por otra cuenta
  if exists (
    select 1 from public.profiles
    where corporate_email_verified
      and lower(corporate_email) = v_email
      and id <> p_profile_id
  ) then
    raise exception 'Ese correo corporativo ya está verificado en otra cuenta';
  end if;

  -- Código de 6 dígitos con aleatoriedad criptográfica
  v_code := lpad(
    (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint
      % 1000000)::text,
    6, '0'
  );

  -- Invalida los códigos anteriores no consumidos de este perfil
  update public.corporate_verifications
     set consumed_at = now()
   where profile_id = p_profile_id
     and consumed_at is null;

  insert into public.corporate_verifications
    (profile_id, corporate_email, token_hash, expires_at)
  values
    (p_profile_id, v_email,
     extensions.crypt(v_code, extensions.gen_salt('bf')),
     now() + interval '15 minutes');

  -- Deja el correo pendiente reflejado en el perfil (sin marcar verificado;
  -- el trigger de protección solo bloquea role y corporate_email_verified)
  update public.profiles set corporate_email = v_email where id = p_profile_id;

  return v_code;
end $$;

revoke execute on function public.issue_corporate_verification(uuid, text)
  from public, anon, authenticated;
grant  execute on function public.issue_corporate_verification(uuid, text)
  to service_role;

-- ---------- Estadísticas: exigir verificación a los no privilegiados ----------
create or replace function public.get_proposal_stats(p_proposal uuid)
returns table (
  scope text,
  work_center_id uuid,
  work_center_name text,
  up_count bigint,
  down_count bigint,
  participation_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_status proposal_status;
  v_role   user_role := public.current_user_role();
begin
  select status into v_status from public.proposals where id = p_proposal;
  if v_status is null then
    raise exception 'Propuesta no encontrada';
  end if;

  if v_role not in ('organizer','admin') then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and corporate_email_verified
    ) then
      raise exception 'Debes verificar tu correo corporativo para ver las estadísticas';
    end if;
    if v_status <> 'closed' then
      raise exception 'Los resultados estarán disponibles al cerrar la votación';
    end if;
  end if;

  return query
  select 'global'::text, null::uuid, null::text,
         count(*) filter (where v.choice='up'),
         count(*) filter (where v.choice='down'),
         (select count(*) from public.participation p where p.proposal_id = p_proposal)
  from public.votes v
  where v.proposal_id = p_proposal
  union all
  select 'center'::text, wc.id, wc.name,
         count(*) filter (where v.choice='up'),
         count(*) filter (where v.choice='down'),
         (select count(*) from public.participation p
           where p.proposal_id = p_proposal and p.work_center_id = wc.id)
  from public.votes v
  join public.work_centers wc on wc.id = v.work_center_id
  where v.proposal_id = p_proposal
  group by wc.id, wc.name;
end $$;
