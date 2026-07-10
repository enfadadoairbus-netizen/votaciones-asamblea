"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Proposal } from "@/lib/types";

export default function VoteCard({
  proposal,
  alreadyVoted,
}: {
  proposal: Proposal;
  alreadyVoted: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyVoted);
  const [error, setError] = useState<string | null>(null);

  async function vote(choice: "up" | "down") {
    setError(null);
    if (proposal.requires_presence_code && code.trim().length === 0) {
      setError("Introduce el código presencial que se ha anunciado en la asamblea.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("cast_vote", {
      p_proposal: proposal.id,
      p_choice: choice,
      p_code: proposal.requires_presence_code ? code.trim() : null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  const ends = new Date(proposal.ends_at);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">{proposal.title}</h2>
        <span className="shrink-0 text-xs text-muted">
          cierra {ends.toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
        </span>
      </div>
      {proposal.description && (
        <p className="mt-2 text-sm text-muted">{proposal.description}</p>
      )}

      {done ? (
        <p className="mt-4 rounded-md bg-favor/10 px-3 py-2 text-sm text-favor">
          Tu voto se ha registrado. Gracias por participar.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {proposal.requires_presence_code && (
            <input
              className="input"
              placeholder="Código presencial"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Código presencial"
            />
          )}
          <div className="flex gap-3">
            <button
              onClick={() => vote("up")}
              disabled={busy}
              className="flex-1 rounded-lg bg-favor px-4 py-3 text-base font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              👍 A favor
            </button>
            <button
              onClick={() => vote("down")}
              disabled={busy}
              className="flex-1 rounded-lg bg-contra px-4 py-3 text-base font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              👎 En contra
            </button>
          </div>
          {error && <p className="text-sm text-contra">{error}</p>}
        </div>
      )}
    </div>
  );
}
