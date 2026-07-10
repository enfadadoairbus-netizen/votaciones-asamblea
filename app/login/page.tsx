import { signIn, signUp } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Votaciones de Asamblea</h1>
          <p className="mt-1 text-sm text-muted">
            Entra con tu cuenta o regístrate. Podrás verificar tu correo corporativo desde tu
            perfil para poder votar.
          </p>
        </div>

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
          <input name="email" type="email" required placeholder="Correo" className="input" />
          <input name="password" type="password" required placeholder="Contraseña" className="input" />
          <button className="btn-brand w-full">Entrar</button>
        </form>

        {/* Crear cuenta */}
        <form action={signUp} className="mt-4 space-y-3 rounded-xl border border-black/10 bg-card p-5">
          <h2 className="text-sm font-semibold">Crear cuenta</h2>
          <input name="full_name" type="text" placeholder="Nombre y apellidos" className="input" />
          <input name="email" type="email" required placeholder="Correo (personal o corporativo)" className="input" />
          <input name="password" type="password" required minLength={8} placeholder="Contraseña (mín. 8)" className="input" />
          <button className="btn-outline w-full">Crear cuenta</button>
        </form>
      </div>
    </main>
  );
}
