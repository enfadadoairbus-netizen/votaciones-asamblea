"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkCenter } from "@/lib/types";

// Modal bloqueante que aparece al entrar si el usuario no tiene centro asignado.
export default function CenterGate({
  profileId,
  centers,
}: {
  profileId: string;
  centers: WorkCenter[];
}) {
  const router = useRouter();
  const [centerId, setCenterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!centerId) {
      setErr("Selecciona tu centro.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ work_center_id: centerId })
      .eq("id", profileId);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm space-y-3 rounded-xl bg-card p-5 shadow-lg">
        <h2 className="text-base font-semibold">Elige tu centro de trabajo</h2>
        <p className="text-sm text-muted">
          Necesitamos tu centro para poder votar en las propuestas que te correspondan.
        </p>
        <select
          className="input"
          value={centerId}
          onChange={(e) => setCenterId(e.target.value)}
          aria-label="Centro de trabajo"
        >
          <option value="" disabled>Centro de trabajo…</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-brand w-full" onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Guardar y continuar"}
        </button>
        {err && <p className="text-sm text-contra">{err}</p>}
      </div>
    </div>
  );
}
