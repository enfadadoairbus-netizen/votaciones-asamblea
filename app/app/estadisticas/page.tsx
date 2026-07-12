import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Proposal, ProposalStat, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const MIN_CENTER = 5; // umbral anti-reidentificación

function Bar({ up, down }: { up: number; down: number }) {
  const total = up + down || 1;
  const pUp = Math.round((up / total) * 100);
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded bg-black/10">
      <div className="h-full bg-favor" style={{ width: `${pUp}%` }} />
    </div>
  );
}

async function Stats({ proposal }: { proposal: Proposal }) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_proposal_stats", {
    p_proposal: proposal.id,
  });

  if (error) {
    return <p className="text-sm text-muted">Resultados no disponibles todavía.</p>;
  }
  const rows = (data ?? []) as ProposalStat[];
  const global = rows.find((r) => r.scope === "global");
  const centers = rows.filter((r) => r.scope === "center");

  return (
    <div className="space-y-3">
      {global && (
        <div>
          <div className="flex justify-between text-sm">
            <span className="font-medium">Global</span>
            <span className="text-muted">
              👍 {global.up_count} · 👎 {global.down_count} · {global.participation_count} votos
            </span>
          </div>
          <Bar up={global.up_count} down={global.down_count} />
        </div>
      )}
      {centers.length > 0 && (
        <div className="space-y-2 border-t border-black/10 pt-2">
          {centers.map((c) => (
            <div key={c.work_center_id}>
              <div className="flex justify-between text-sm">
                <span>{c.work_center_name}</span>
                {c.participation_count < MIN_CENTER ? (
                  <span className="text-muted">oculto (menos de {MIN_CENTER} votos)</span>
                ) : (
                  <span className="text-muted">
                    👍 {c.up_count} · 👎 {c.down_count}
                  </span>
                )}
              </div>
              {c.participation_count >= MIN_CENTER && <Bar up={c.up_count} down={c.down_count} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function EstadisticasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, corporate_email_verified")
    .eq("id", user!.id)
    .single<Pick<Profile, "role" | "corporate_email_verified">>();

  const canSeeLive = profile?.role === "organizer" || profile?.role === "admin";

  if (profile?.role === "employee" && !profile.corporate_email_verified) {
    return (
      <div className="card text-center text-muted">
        <p>Para ver las estadísticas necesitas verificar tu correo corporativo.</p>
        <Link href="/app/perfil" className="mt-2 inline-block text-brand underline">
          Ir a mi perfil
        </Link>
      </div>
    );
  }
  const statuses = canSeeLive ? ["active", "closed"] : ["closed"];

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, description, starts_at, ends_at, requires_presence_code, status")
    .in("status", statuses)
    .order("ends_at", { ascending: false })
    .returns<Proposal[]>();

  if (!proposals || proposals.length === 0) {
    return <div className="card text-center text-muted">Aún no hay resultados que mostrar.</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Estadísticas</h1>
      {proposals.map((p) => (
        <div key={p.id} className="card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{p.title}</h2>
            <span className="text-xs uppercase tracking-wide text-muted">{p.status}</span>
          </div>
          <div className="mt-3">
            <Stats proposal={p} />
          </div>
        </div>
      ))}
    </div>
  );
}
