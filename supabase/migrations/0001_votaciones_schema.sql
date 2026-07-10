-- =====================================================================
-- Votaciones de Asamblea — Esquema Supabase (PostgreSQL) + RLS
-- ---------------------------------------------------------------------
-- PROPIEDAD CLAVE: VOTO SECRETO.
--   * participation  -> QUIÉN votó (sin el sentido). Impide el doble voto.
--   * votes          -> QUÉ se votó (sin vínculo al usuario).
-- Las dos tablas nunca se cruzan. `votes` no tiene NINGUNA política de
-- SELECT: nadie lee filas individuales; el recuento se expone solo en
-- agregado vía get_proposal_stats().
-- Todas las funciones sensibles son SECURITY DEFINER con search_path fijo.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tipos ----------
create type user_role       as enum ('employee','organizer','admin');
create type proposal_status as enum ('draft','active','closed');
create type vote_choice     as enum ('up','down');
create type notif_audience  as enum ('all','center','proposal');

-- ---------- Tablas ----------
create table public.settings (
  id boolean primary key default true,           -- fila única (singleton)
  allowed_domains text[] not null default '{}',  -- dominios corporativos admitidos
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id)
);

create table public.work_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  work_center_id uuid references public.work_centers on delete set null,
  corporate_email text,
  corporate_email_verified boolean not null default false,
  role user_role not null default 'employee',
  created_at timestamptz not null default now()
);

create table public.corporate_verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  corporate_email text not null,
  token_hash text not null,                      -- crypt(token, gen_salt('bf'))
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references public.profiles,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  requires_presence_code boolean not null default true,
  verbal_code_hash text,                         -- null si no se exige código
  status proposal_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint proposals_window check (ends_at > starts_at),
  constraint proposals_code_present
    check (not requires_presence_code or verbal_code_hash is not null)
);

create table public.proposal_work_centers (
  proposal_id    uuid references public.proposals    on delete cascade,
  work_center_id uuid references public.work_centers on delete cascade,
  primary key (proposal_id, work_center_id)
);

-- QUIÉN votó (sin el sentido del voto)
create table public.participation (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals on delete cascade,
  user_id     uuid not null references public.profiles  on delete cascade,
  work_center_id uuid references public.work_centers,
  voted_at timestamptz not null default now(),
  unique (proposal_id, user_id)                  -- impide el doble voto
);

-- QUÉ se votó (sin vínculo al usuario)
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals on delete cascade,
  choice vote_choice not null,
  work_center_id uuid references public.work_centers,  -- para estadística por centro
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth   text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles,
  audience notif_audience not null,
  work_center_id uuid references public.work_centers,
  proposal_id    uuid references public.proposals,
  title text not null,
  body  text not null,
  created_at timestamptz not null default now()
);

create index on public.proposal_work_centers (work_center_id);
create index on public.participation (proposal_id);
create index on public.votes (proposal_id, work_center_id);

-- =====================================================================
-- Funciones auxiliares
-- =====================================================================

-- Rol del usuario actual. SECURITY DEFINER para NO recursar sobre las
-- políticas RLS de profiles.
create or replace function public.current_user_role()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- ¿El dominio del email está en la lista de admitidos?
create or replace function public.is_allowed_domain(p_email text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.settings s
    where lower(split_part(p_email,'@',2)) = any (
      select lower(d) from unnest(s.allowed_domains) d
    )
  )
$$;

-- Impide que un usuario no-admin se cambie el rol o se autoverifique.
-- Las funciones de confianza fijan app.trusted='1' para poder escribir
-- esas columnas de forma controlada.
create or replace function public.protect_profile_privileged_cols()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'admin'
     and current_setting('app.trusted', true) is distinct from '1' then
    if new.role is distinct from old.role then
      raise exception 'No puedes cambiar tu propio rol';
    end if;
    if new.corporate_email_verified is distinct from old.corporate_email_verified then
      raise exception 'No puedes autoverificar tu correo corporativo';
    end if;
  end if;
  return new;
end $$;

create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_cols();

-- Crea el profile al registrarse un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Verificación de correo corporativo
-- El ENVÍO del token se hace desde una Edge Function (service_role):
-- valida is_allowed_domain(), genera el token, guarda crypt(token) y lo
-- manda SOLO al correo corporativo. El token en claro NUNCA vuelve al
-- cliente. Aquí queda solo la confirmación.
-- =====================================================================
create or replace function public.confirm_corporate_verification(p_token text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare v public.corporate_verifications;
begin
  select * into v
  from public.corporate_verifications
  where profile_id = auth.uid()
    and consumed_at is null
    and expires_at > now()
  order by expires_at desc
  limit 1;

  if v.id is null or v.token_hash <> extensions.crypt(p_token, v.token_hash) then
    raise exception 'Token inválido o caducado';
  end if;

  perform set_config('app.trusted','1', true);   -- transacción local
  update public.profiles
     set corporate_email_verified = true,
         corporate_email = v.corporate_email
   where id = auth.uid();

  update public.corporate_verifications set consumed_at = now() where id = v.id;
  perform set_config('app.trusted','', true);     -- revoca el permiso de confianza
end $$;

-- =====================================================================
-- Emisión de voto (secreta, atómica, con validaciones)
-- =====================================================================
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
begin
  select * into v_profile  from public.profiles  where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Perfil no encontrado';
  end if;
  if not v_profile.corporate_email_verified then
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

  -- El centro del usuario debe estar entre los centros destino
  if not exists (
    select 1 from public.proposal_work_centers pwc
    where pwc.proposal_id = p_proposal
      and pwc.work_center_id = v_profile.work_center_id
  ) then
    raise exception 'Tu centro de trabajo no participa en esta propuesta';
  end if;

  -- Código presencial (solo si la propuesta lo exige)
  if v_proposal.requires_presence_code then
    if p_code is null
       or v_proposal.verbal_code_hash is null
       or v_proposal.verbal_code_hash <> extensions.crypt(p_code, v_proposal.verbal_code_hash) then
      raise exception 'Código presencial incorrecto';
    end if;
  end if;

  -- Inserción desacoplada. El unique(proposal_id,user_id) garantiza 1 voto.
  begin
    insert into public.participation (proposal_id, user_id, work_center_id)
    values (p_proposal, v_profile.id, v_profile.work_center_id);
  exception when unique_violation then
    raise exception 'Ya has votado en esta propuesta';
  end;

  insert into public.votes (proposal_id, choice, work_center_id)
  values (p_proposal, p_choice, v_profile.work_center_id);
end $$;

-- =====================================================================
-- Estadísticas agregadas (global + por centro)
-- Organizador/admin en cualquier momento; empleado solo tras el cierre.
-- Nota anti-reidentificación: en la capa de aplicación, no mostrar el
-- desglose de un centro con participación por debajo de un umbral (p.ej. 5).
-- =====================================================================
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
declare v_status proposal_status;
begin
  select status into v_status from public.proposals where id = p_proposal;
  if v_status is null then
    raise exception 'Propuesta no encontrada';
  end if;
  if public.current_user_role() not in ('organizer','admin')
     and v_status <> 'closed' then
    raise exception 'Los resultados estarán disponibles al cerrar la votación';
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

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.settings               enable row level security;
alter table public.work_centers           enable row level security;
alter table public.profiles               enable row level security;
alter table public.corporate_verifications enable row level security;
alter table public.proposals              enable row level security;
alter table public.proposal_work_centers  enable row level security;
alter table public.participation          enable row level security;
alter table public.votes                  enable row level security;
alter table public.push_subscriptions     enable row level security;
alter table public.notifications          enable row level security;

-- settings: solo admin (la validación de dominio va por is_allowed_domain)
create policy settings_admin_all on public.settings
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- work_centers: lectura para autenticados; escritura admin
create policy wc_select on public.work_centers
  for select using (auth.uid() is not null);
create policy wc_admin_write on public.work_centers
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- profiles: cada uno el suyo; admin todos (trigger protege role/verified)
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.current_user_role() = 'admin');
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.current_user_role() = 'admin')
  with check   (id = auth.uid() or public.current_user_role() = 'admin');
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- corporate_verifications: solo el interesado ve las suyas (creación/consumo
-- se hace vía Edge Function/RPC SECURITY DEFINER)
create policy cv_select_own on public.corporate_verifications
  for select using (profile_id = auth.uid());

-- proposals: organizador/admin todo; empleado solo las no-draft de su centro
create policy proposals_select on public.proposals
  for select using (
    public.current_user_role() in ('organizer','admin')
    or (
      status <> 'draft'
      and exists (
        select 1 from public.proposal_work_centers pwc
        join public.profiles pr on pr.id = auth.uid()
        where pwc.proposal_id = proposals.id
          and pwc.work_center_id = pr.work_center_id
      )
    )
  );
create policy proposals_write on public.proposals
  for all using (public.current_user_role() in ('organizer','admin'))
  with check (public.current_user_role() in ('organizer','admin'));

-- proposal_work_centers: lectura autenticados; escritura organizador/admin
create policy pwc_select on public.proposal_work_centers
  for select using (auth.uid() is not null);
create policy pwc_write on public.proposal_work_centers
  for all using (public.current_user_role() in ('organizer','admin'))
  with check (public.current_user_role() in ('organizer','admin'));

-- participation: cada empleado ve SOLO su propia participación.
-- (organizador/admin usan get_proposal_stats en agregado, no filas)
create policy participation_select_own on public.participation
  for select using (user_id = auth.uid());
-- Sin política de INSERT: solo entra vía cast_vote (SECURITY DEFINER).

-- votes: SIN política de SELECT ni INSERT -> voto secreto.
-- Solo cast_vote inserta y get_proposal_stats agrega (ambas DEFINER).

-- push_subscriptions: cada uno gestiona las suyas
create policy push_own on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notifications: destinatarios leen las suyas; envían organizador/admin
create policy notif_select on public.notifications
  for select using (
    audience = 'all'
    or public.current_user_role() in ('organizer','admin')
    or (audience = 'center'
        and work_center_id = (select work_center_id from public.profiles where id = auth.uid()))
  );
create policy notif_insert on public.notifications
  for insert with check (
    public.current_user_role() in ('organizer','admin')
    and sender_id = auth.uid()
  );

-- =====================================================================
-- Privilegios de ejecución de RPCs
-- =====================================================================
revoke execute on function public.cast_vote(uuid, vote_choice, text) from public, anon;
grant  execute on function public.cast_vote(uuid, vote_choice, text) to authenticated;

revoke execute on function public.confirm_corporate_verification(text) from public, anon;
grant  execute on function public.confirm_corporate_verification(text) to authenticated;

revoke execute on function public.get_proposal_stats(uuid) from public, anon;
grant  execute on function public.get_proposal_stats(uuid) to authenticated;

-- is_allowed_domain la usa la Edge Function (service_role)
revoke execute on function public.is_allowed_domain(text) from public, anon;
