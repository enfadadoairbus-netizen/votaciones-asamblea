-- =====================================================================
-- 0007 — Centro de trabajo elegido en el registro
-- ---------------------------------------------------------------------
-- El formulario de alta necesita listar los centros ANTES de haber sesión,
-- así que se permite leer work_centers de forma pública (solo nombres, no es
-- dato sensible). handle_new_user guarda el work_center_id elegido al registrarse.
-- =====================================================================

-- Lectura pública de centros (para el desplegable del registro)
drop policy if exists wc_select on public.work_centers;
create policy wc_select_public on public.work_centers
  for select using (true);

-- El alta guarda también el centro elegido (validado contra work_centers)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_corp text := nullif(trim(new.raw_user_meta_data->>'corporate_email'), '');
  v_wc   uuid;
begin
  begin
    v_wc := nullif(new.raw_user_meta_data->>'work_center_id', '')::uuid;
  exception when others then
    v_wc := null;
  end;
  if v_wc is not null and not exists (select 1 from public.work_centers where id = v_wc) then
    v_wc := null;
  end if;

  insert into public.profiles (id, full_name, corporate_email, work_center_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    lower(v_corp),
    v_wc
  );
  return new;
end $$;
