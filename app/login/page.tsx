import { signIn, signUp } from "./actions";
import { createClient } from "@/lib/supabase/server";
import type { WorkCenter } from "@/lib/types";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  const supabase = createClient();
  const { data: centers } = await supabase
    .from("work_centers")
    .select("id, name, code")
    .order("name")
    .returns<WorkCenter[]>();

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Cabecera / objetivo de la app */}
        <header className="mb-8">
          <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Votación de la asamblea
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">
            Asamblea Empleados 1J
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Plataforma para votar las propuestas de la asamblea de forma{" "}
            <strong className="text-ink">rápida, secreta y desde tu móvil</strong>. Sustituye a la
            votación a mano alzada: cada empleado vota una sola vez, el voto es anónimo y los
            resultados se publican de forma transparente al cerrar cada votación.
          </p>

          <ul className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2 rounded-lg border border-black/10 bg-card px-3 py-2">
              <span aria-hidden>🔒</span> Voto secreto y anónimo
            </li>
            <li className="flex items-center gap-2 rounded-lg border border-black/10 bg-card px-3 py-2">
              <span aria-hidden>📱</span> Vota desde tu móvil
            </li>
            <li className="flex items-center gap-2 rounded-lg border border-black/10 bg-card px-3 py-2">
              <span aria-hidden>🏭</span> Por centros de trabajo
            </li>
            <li className="flex items-center gap-2 rounded-lg border border-black/10 bg-card px-3 py-2">
              <span aria-hidden>📊</span> Resultados transparentes
            </li>
          </ul>
        </header>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-contra/10 px-3 py-2 text-sm text-contra">
            {searchParams.error}
          </p>
        )}
        {searchParams.message && (
          <p className="mb-4 rounded-md bg-favor/10 px-3 py-2 text-sm text-favor">
            {searchParams.message}
          </p>
        )}

        {/* Entrar */}
        <form action={signIn} className="space-y-3 rounded-xl border border-black/10 bg-card p-5">
          <h2 className="text-sm font-semibold">Entrar</h2>
          <input name="email" type="email" required placeholder="Correo personal" className="input" />
          <input name="password" type="password" required placeholder="Contraseña" className="input" />
          <button className="btn-brand w-full">Entrar</button>
        </form>

        {/* Crear cuenta */}
        <form action={signUp} className="mt-4 space-y-3 rounded-xl border border-black/10 bg-card p-5">
          <h2 className="text-sm font-semibold">Crear cuenta</h2>
          <input name="full_name" type="text" placeholder="Nombre y apellidos" className="input" />
          <div>
            <input name="email" type="email" required placeholder="Correo personal (tu cuenta)" className="input" />
            <p className="mt-1 text-xs text-muted">Con este correo entras y recuperas la contraseña. Es obligatorio.</p>
          </div>
          <div>
            <input name="corporate_email" type="email" placeholder="Correo corporativo (Airbus)" className="input" />
            <p className="mt-1 text-xs text-muted">Tu correo de empresa, para acreditar que eres empleado/a. Podrás completarlo también desde tu perfil.</p>
          </div>
          <div>
            <select name="work_center_id" required defaultValue="" className="input">
              <option value="" disabled>Centro de trabajo…</option>
              {(centers ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Elige tu centro. Podrás cambiarlo luego desde tu perfil.</p>
          </div>
          <input name="password" type="password" required minLength={8} placeholder="Contraseña (mín. 8)" className="input" />
          <button className="btn-outline w-full">Crear cuenta</button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          El voto es secreto: nadie —ni la organización— puede ver qué has votado. Solo se
          publican los recuentos agregados.
        </p>
      </div>
    </main>
  );
}
