"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkCenter, Profile, Role } from "@/lib/types";

export default function AdminPanel({
  domains,
  centers,
  people,
}: {
  domains: string[];
  centers: WorkCenter[];
  people: Profile[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [domainText, setDomainText] = useState(domains.join(", "));
  const [newCenter, setNewCenter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // Correo corporativo editable por persona (para la verificación manual)
  const [corpEmails, setCorpEmails] = useState<Record<string, string>>(
    Object.fromEntries(people.map((p) => [p.id, p.corporate_email ?? ""]))
  );

  async function saveDomains() {
    setMsg(null);
    const list = domainText.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase
      .from("settings")
      .upsert({ id: true, allowed_domains: list, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : "Dominios guardados.");
    router.refresh();
  }

  async function addCenter() {
    if (!newCenter.trim()) return;
    const { error } = await supabase.from("work_centers").insert({ name: newCenter.trim() });
    setMsg(error ? error.message : "Centro añadido.");
    setNewCenter("");
    router.refresh();
  }

  async function setRole(id: string, role: Role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setMsg(error ? error.message : "Rol actualizado.");
    router.refresh();
  }

  // Verificación manual (red de seguridad si el correo no llega).
  // El admin puede acreditar a una persona sin código de email.
  async function verify(id: string) {
    setMsg(null);
    const email = (corpEmails[id] ?? "").trim().toLowerCase();
    if (!email) {
      setMsg("Escribe el correo corporativo de esa persona antes de verificar.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ corporate_email: email, corporate_email_verified: true })
      .eq("id", id);
    setMsg(error ? error.message : "Persona verificada manualmente.");
    router.refresh();
  }

  async function unverify(id: string) {
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ corporate_email_verified: false })
      .eq("id", id);
    setMsg(error ? error.message : "Verificación anulada.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-md bg-brand/10 px-3 py-2 text-sm text-brand">{msg}</p>}

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">Dominios corporativos admitidos</h2>
        <p className="text-xs text-muted">Separados por comas. Ej: empresa.com, empresa.es</p>
        <input className="input" value={domainText} onChange={(e) => setDomainText(e.target.value)} />
        <button className="btn-brand" onClick={saveDomains}>Guardar dominios</button>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold">Centros de trabajo</h2>
        <ul className="text-sm">
          {centers.map((c) => (
            <li key={c.id} className="border-b border-black/5 py-1">{c.name}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="input" placeholder="Nuevo centro" value={newCenter} onChange={(e) => setNewCenter(e.target.value)} />
          <button className="btn-outline" onClick={addCenter}>Añadir</button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold">Personas</h2>
        <p className="text-xs text-muted">
          Rol y verificación del correo corporativo. La verificación manual es la red de
          seguridad para quien no reciba el código por email.
        </p>
        <div className="divide-y divide-black/5">
          {people.map((p) => (
            <div key={p.id} className="space-y-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{p.full_name || "(sin nombre)"}</p>
                  <p className="truncate text-xs text-muted">
                    {p.corporate_email_verified ? (
                      <span className="text-favor">✓ verificado</span>
                    ) : (
                      <span>sin verificar</span>
                    )}
                  </p>
                </div>
                <select
                  className="input w-auto"
                  value={p.role}
                  onChange={(e) => setRole(p.id, e.target.value as Role)}
                >
                  <option value="employee">Empleado</option>
                  <option value="organizer">Organizador</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1 min-w-[12rem]"
                  type="email"
                  placeholder="correo corporativo"
                  value={corpEmails[p.id] ?? ""}
                  onChange={(e) =>
                    setCorpEmails((s) => ({ ...s, [p.id]: e.target.value }))
                  }
                />
                {p.corporate_email_verified ? (
                  <button className="btn-outline" onClick={() => unverify(p.id)}>
                    Anular
                  </button>
                ) : (
                  <button className="btn-brand" onClick={() => verify(p.id)}>
                    Verificar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
