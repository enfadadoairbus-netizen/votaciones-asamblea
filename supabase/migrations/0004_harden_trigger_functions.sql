-- =====================================================================
-- 0004 — Endurecimiento: las funciones de trigger no deben ser invocables
-- vía la API REST. Son SECURITY DEFINER y solo tienen sentido como triggers,
-- así que revocamos su EXECUTE de public/anon/authenticated (quita el aviso
-- del advisor 0028/0029 sin afectar a los triggers, que corren como owner).
-- =====================================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_privileged_cols() from public, anon, authenticated;
