-- =====================================================================
-- 0005 — RPC admin_list_people
-- El panel de Admin necesita ver, por persona, el nombre y el CORREO DE LA
-- CUENTA (auth.users.email), que no es accesible desde el cliente ni con RLS.
-- Este RPC SECURITY DEFINER lo expone SOLO a administradores.
-- =====================================================================
create or replace function public.admin_list_people()
returns table (
  id uuid,
  full_name text,
  account_email text,
  corporate_email text,
  corporate_email_verified boolean,
  role user_role,
  work_center_id uuid
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden listar personas';
  end if;

  return query
  select p.id, p.full_name, u.email::text,
         p.corporate_email, p.corporate_email_verified, p.role, p.work_center_id
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.full_name nulls last;
end $$;

revoke execute on function public.admin_list_people() from public, anon;
grant  execute on function public.admin_list_people() to authenticated;
