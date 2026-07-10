# Votaciones de Asamblea

App web (Next.js 14 + Supabase) para votar propuestas en tiempo real durante asambleas.
Voto secreto, roles (empleado / organizador / admin), verificación por correo corporativo
y código presencial opcional.

## Puesta en marcha

1. Instala dependencias:
   ```bash
   npm install
   ```

2. Copia `.env.local.example` a `.env.local` y rellena con los datos de tu proyecto
   (Dashboard → Project Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. Aplica las migraciones de `supabase/migrations/` (por orden) en el SQL Editor del
   proyecto, o con la CLI de Supabase. `0001` es el esquema base (ya aplicado si lo hicimos
   desde el chat); `0002` añade el RPC `create_proposal`.

4. Arranca en local:
   ```bash
   npm run dev
   ```

## Bootstrap del primer administrador

No existe ningún admin al principio, así que hazte admin una vez tras registrarte, desde el
SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'TU_CORREO');
```

Después, entra en la pestaña **Admin** para definir los dominios corporativos admitidos y los
centros de trabajo, y para gestionar roles.

## Estructura

- `app/login` — entrar / crear cuenta (server actions).
- `app/app` — zona autenticada con pestañas por rol.
  - `votaciones` — propuestas abiertas + voto (RPC `cast_vote`).
  - `estadisticas` — resultados global y por centro (RPC `get_proposal_stats`).
  - `perfil` — datos, centro y verificación del correo corporativo.
  - `crear` — crear propuesta (organizador/admin, RPC `create_proposal`).
  - `admin` — dominios, centros y roles.
- `lib/supabase` — clientes de navegador/servidor y middleware de sesión.

## Pendiente (Edge Functions — siguiente paso)

- **Verificación corporativa**: valida el dominio, genera el token, lo guarda hasheado y lo
  envía SOLO al correo de empresa. El token en claro nunca vuelve al cliente.
- **Push**: Web Push con VAPID para comunicados y para el aviso de nueva propuesta en tu centro.

## Notas de seguridad

- El voto es secreto: la tabla `votes` no tiene políticas RLS de lectura; el recuento solo se
  expone agregado. La participación se registra por separado, sin el sentido del voto.
- Las estadísticas ocultan el desglose de un centro con menos de 5 votos (anti-reidentificación).
- Los proyectos Free de Supabase se auto-pausan por inactividad: para uso en asambleas reales,
  considera el plan Pro para evitar que se pause en el momento clave.
