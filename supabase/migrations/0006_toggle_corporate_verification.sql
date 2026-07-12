-- =====================================================================
-- 0006 — Interruptor: exigir (o no) verificación del correo corporativo
-- ---------------------------------------------------------------------
-- Añade settings.require_corporate_verification. Cuando está en false, votar
-- y ver estadísticas NO exige tener el corporativo verificado (el control de
-- elegibilidad recae en el código presencial). cast_vote y get_proposal_stats
-- respetan el interruptor. Por defecto true (seguro); aquí se deja en false
-- para el arranque del piloto.
-- =====================================================================
alter table public.settings
  add column if not exists require_corporate_verification boolean not null default true;

-- Arranque del piloto: desactivado (se controla por código presencial).
update public.settings set require_corporate_verification = false where id = true;

-- ---------- cast_vote respeta el interruptor ----------
create or replace function public.cast_vote(
  p_proposal uuid,
  p_choice   vote_choice,
  p_code     text default null
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_profile  public.profiles;
  v_proposal public.proposals;
  v_require  boolean;
begin
  select coalesce((select require_corporate_verification from public.settings where id = true), true)
    into v_require;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Perfil no encontrado';
  end if;
  if v_require and not v_profile.corporate_email_verified then
    raise exception 'Debes verificar tu correo corporativo para votar';
  end if;

  select * into v_proposal from public.proposals where id = p_proposal;
  if v_proposal.id is null then
    raise exception 'Propuesta no encontrada';
  end if;
  if v_proposal.status <> 'active'
     or now() < v_proposal.starts_at
     or now() > v_proposal.ends_at then
    raise exception 'La votación no está abierta';
  end if;

  if not exists (
    select 1 from public.proposal_work_centers pwc
    where pwc.proposal_id = p_proposal
      and pwc.work_center_id = v_profile.work_center_id
  ) then
    raise exception 'Tu centro de trabajo no participa en esta propuesta';
  end if;

  if v_proposal.requires_presence_code then
    if p_code is null
       or v_proposal.verbal_code_hash is null
       or v_proposal.verbal_code_hash <> extensions.crypt(p_code, v_proposal.verbal_code_hash) then
      raise exception 'Código presencial incorrecto';
    end if;
  end if;

  begin
    insert into public.participation (proposal_id, user_id, work_center_id)
    values (p_proposal, v_profile.id, v_profile.work_center_id);
  exception when unique_violation then
    raise exception 'Ya has votado en esta propuesta';
  end;

  insert into public.votes (proposal_id, choice, work_center_id)
  values (p_proposal, p_choice, v_profile.work_center_id);
end $$;

-- ---------- get_proposal_stats respeta el interruptor ----------
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
  v_status  proposal_status;
  v_role    user_role := public.current_user_role();
  v_require boolean;
begin
  select coalesce((select require_corporate_verification from public.settings where id = true), true)
    into v_require;

  select status into v_status from public.proposals where id = p_proposal;
  if v_status is null then
    raise exception 'Propuesta no encontrada';
  end if;

  if v_role not in ('organizer','admin') then
    if v_require and not exists (
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
