import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Proposal, Profile } from "@/lib/types";
import VoteCard from "./VoteCard";

export const dynamic = "force-dynamic";

export default async function VotacionesPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, corporate_email_verified")
    .eq("id", user!.id)
    .single<Pick<Profile, "role" | "corporate_email_verified">>();

  if (profile?.role === "employee" && !profile.corporate_email_verified) {
    return (
      <div className="card text-center text-muted">
        <p>Para votar necesitas verificar tu correo corporativo.</p>
        <Link href="/app/perfil" className="mt-2 inline-block text-brand underline">
          Ir a mi perfil
        </Link>
      </div>
    );
  }

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, description, starts_at, ends_at, requires_presence_code, status")
    .eq("status", "active")
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("ends_at", { ascending: true })
    .returns<Proposal[]>();

  const { data: mine } = await supabase.from("participation").select("proposal_id");
  const voted = new Set((mine ?? []).map((r) => r.proposal_id));

  if (!proposals || proposals.length === 0) {
    return (
      <div className="card text-center text-muted">
        No hay votaciones abiertas ahora mismo.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Votaciones en curso</h1>
      {proposals.map((p) => (
        <VoteCard key={p.id} proposal={p} alreadyVoted={voted.has(p.id)} />
      ))}
    </div>
  );
}
