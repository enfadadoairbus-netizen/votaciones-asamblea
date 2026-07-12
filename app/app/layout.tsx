import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/types";
import Nav from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, work_center_id, corporate_email, corporate_email_verified, role")
    .eq("id", user.id)
    .single<Profile>();

  const { data: settings } = await supabase
    .from("settings")
    .select("require_corporate_verification")
    .eq("id", true)
    .maybeSingle<{ require_corporate_verification: boolean }>();

  const role = profile?.role ?? "employee";
  const verified = !!profile?.corporate_email_verified;
  const requireVerification = settings?.require_corporate_verification ?? true;
  const showVerifyNudge = requireVerification && !verified;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-black/10 bg-card px-4 py-3">
        <span className="font-semibold tracking-tight">Asamblea Empleados 1J</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{profile?.full_name || user.email}</span>
          <form action={signOut}>
            <button className="text-brand hover:underline">Salir</button>
          </form>
        </div>
      </header>

      <Nav role={role} verified={verified} requireVerification={requireVerification} />

      {showVerifyNudge && (
        <div className="bg-contra/10 px-4 py-2 text-sm text-contra">
          Aún no puedes votar: verifica tu correo corporativo desde{" "}
          <Link href="/app/perfil" className="underline">
            tu perfil
          </Link>
          .
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
