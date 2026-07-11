# CLAUDE.md — Votaciones de Asamblea

Contexto del proyecto para cualquier sesión de Claude Code. Léelo antes de tocar nada.

## Qué es
App web para votar propuestas en tiempo real durante asambleas (sustituye la votación a
mano alzada). Voto **secreto**. Roles: empleado / organizador / admin.

## Stack
- Next.js 14 (App Router, TypeScript) + Tailwind.
- Supabase (Postgres, Auth, RLS) — proyecto propio, región UE (París).
- Deploy en Vercel. Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Migraciones en `supabase/migrations/` (aplicar en orden: 0001, 0002, 0003).

## Arquitectura de seguridad — NO romper
- **Voto secreto**: `participation` (quién votó, sin el sentido) y `votes` (el 👍/👎 sin
  usuario) están desacopladas y no se cruzan. `votes` NO tiene política de SELECT: nadie,
  ni admin, lee el sentido por fila. El recuento solo se expone agregado por
  `get_proposal_stats`. No añadir lecturas a `votes`.
- **Autorización en la BD**: RLS en las 10 tablas. No confiar solo en el frontend.
- **RPCs `SECURITY DEFINER` con `search_path` fijo** (evita el aviso de los advisors).
- **Anti-escalada**: trigger `trg_protect_profile` impide que un no-admin cambie su `role`
  o su `corporate_email_verified`. Las funciones de confianza usan el flag transaccional
  `app.trusted` para escribir esas columnas de forma controlada.
- **Verificación en dos pasos** (desacoplada en el tiempo):
  1. Correo **personal** = la cuenta (Supabase Auth): login, recuperación, notificaciones.
     Único por Auth. Con esto se entra a la app, pero NO se vota ni se ven estadísticas.
  2. Correo **corporativo** = prueba de empleo: se valida el dominio (`is_allowed_domain`),
     se envía un código SOLO a ese correo y al confirmarlo (`confirm_corporate_verification`)
     se desbloquean voto y estadísticas. Puede hacerse en un segundo momento.
- **Unicidad**: personal por Auth; corporativo por índice único (una cuenta por empleado).
- **Gating**: votar y ver estadísticas requieren `corporate_email_verified = true` (ya
  aplicado a nivel de BD en `cast_vote` y `get_proposal_stats`).
- **Nunca** exponer al cliente la `service_role` ni el código de verificación en claro.
- Estadísticas por centro: ocultar el desglose de un centro con < 5 votos (anti-reidentificación).

## Modelo de datos (resumen)
Tablas: `settings` (allowed_domains), `work_centers`, `profiles` (role, work_center_id,
corporate_email, corporate_email_verified), `corporate_verifications`, `proposals`
(requires_presence_code, verbal_code_hash, status), `proposal_work_centers`,
`participation`, `votes`, `push_subscriptions`, `notifications`.

RPCs: `cast_vote(p_proposal, p_choice, p_code)`, `confirm_corporate_verification(p_token)`,
`get_proposal_stats(p_proposal)`, `create_proposal(...)`, helpers `current_user_role()` e
`is_allowed_domain(email)`.

## Convenciones
- La UI y los textos van en **español**.
- Móvil primero (se vota desde el móvil en la asamblea): botones grandes, etiquetas de
  texto además de color (daltonismo).
- Tokens Tailwind ya definidos: `brand`, `favor`, `contra`, `ink`, `paper`, `muted`.
- Cualquier hash (código presencial, tokens) con bcrypt vía `extensions.crypt`.

## Estado actual
Hecho: esquema + RLS + voto secreto + roles + crear propuesta + votar + perfil + admin +
estadísticas; migraciones 0001–0003 aplicadas.

Pendiente (tareas actuales):
1. **Registro con dos campos**: personal (cuenta, obligatorio) y corporativo (opcional,
   puede añadirse luego). Separar en `app/login`.
2. **Edge Function `request-corporate-verification`**: valida dominio con `is_allowed_domain`,
   comprueba que el corporativo no está ya verificado en otra cuenta, genera código, guarda
   su hash en `corporate_verifications` con caducidad, y lo envía SOLO al corporativo. El
   código en claro no vuelve al cliente. Proveedor de email por variable de entorno.
3. **UX "verifícate luego"** en `app/app/perfil`: añadir/reenviar/confirmar el corporativo
   en cualquier momento; ocultar o bloquear En curso (voto) y Estadísticas hasta verificar.

Próximo bloque tras esto: Web Push (VAPID) para comunicados ad-hoc y aviso de nueva
propuesta en tu centro.

## Reglas de trabajo
- Aplicar migraciones en orden y no editar las ya aplicadas; los cambios de esquema van en
  una migración nueva.
- Mantén este `CLAUDE.md` actualizado cuando cambien decisiones o el estado.
