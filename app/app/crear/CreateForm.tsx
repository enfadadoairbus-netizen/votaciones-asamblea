"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkCenter } from "@/lib/types";

export default function CreateForm({ centers }: { centers: WorkCenter[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [requiresCode, setRequiresCode] = useState(true);
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit() {
    setMsg(null);
    if (!title.trim()) return setMsg("Falta el título.");
    if (selected.length === 0) return setMsg("Selecciona al menos un centro.");
    if (requiresCode && !code.trim()) return setMsg("Falta el código presencial.");

    setBusy(true);
    const now = new Date();
    const ends = new Date(now.getTime() + minutes * 60_000);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_proposal", {
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_starts_at: now.toISOString(),
      p_ends_at: ends.toISOString(),
      p_requires_code: requiresCode,
      p_code: requiresCode ? code.trim() : null,
      p_center_ids: selected,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg("Propuesta creada y abierta a votación.");
    setTitle(""); setDescription(""); setCode(""); setSelected([]);
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="text-xs font-medium text-muted" htmlFor="t">Título</label>
        <input id="t" className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted" htmlFor="d">Descripción</label>
        <textarea id="d" className="input mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted" htmlFor="m">Duración (minutos)</label>
        <input id="m" type="number" min={1} className="input mt-1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-muted">Centros de trabajo</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {centers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={
                "rounded-full border px-3 py-1 text-sm " +
                (selected.includes(c.id)
                  ? "border-brand bg-brand text-white"
                  : "border-black/15 text-ink")
              }
            >
              {c.name}
            </button>
          ))}
          {centers.length === 0 && <span className="text-sm text-muted">No hay centros. Créalos en Admin.</span>}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={requiresCode} onChange={(e) => setRequiresCode(e.target.checked)} />
        Requiere código presencial
      </label>
      {requiresCode && (
        <input className="input" placeholder="Código a anunciar en la sala" value={code} onChange={(e) => setCode(e.target.value)} />
      )}

      <button className="btn-brand" onClick={submit} disabled={busy}>Crear y abrir votación</button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
