"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkCenter, AdminPerson, Role } from "@/lib/types";

export default function AdminPanel({
  domains,
  requireVerification,
  centers,
  people,
}: {
  domains: string[];
  requireVerification: boolean;
  centers: WorkCenter[];
  people: AdminPerson[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [domainText, setDomainText] = useState(domains.join(", "));
  const [requireVerif, setRequireVerif] = useState(requireVerification);
  const [newCenter, setNewCenter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  // Correo corporativo editable por persona (para la verificación individual)
  const [corpEmails, setCorpEmails] = useState<Record<string, string>>(
    Object.fromEntries(people.map((p) => [p.id, p.corporate_email ?? ""]))
  );
  // Selección para acciones en lote
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => people.map((p) => p.id).filter((id) => selected[id]),
    [selected, people]
  );
  const allSelected = people.length > 0 && selectedIds.length === people.length;

  async function saveDomains() {
    setMsg(null);
    const list = domainText.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase
      .from("settings")
      .upsert({ id: true, allowed_domains: list, updated_at: new Date().toISOString() });
    setMsg(error ? error.message : "Dominios guardados.");
    router.refresh();
  }

  async function toggleRequireVerif(value: boolean) {
    setMsg(null);
    setRequireVerif(value);
    const { error } = await supabase
      .from("settings")
      .upsert({ id: true, require_corporate_verification: value, updated_at: new Date().toISOString() });
    if (error) {
      setRequireVerif(!value); // revierte en caso de error
      setMsg(error.message);
    } else {
      setMsg(value ? "Verificación por email ACTIVADA." : "Verificación por email DESACTIVADA.");
    }
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

  // --- Verificación manual (red de seguridad si el correo no llega) ---
  async function verifyOne(id: string) {
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

  async function unverifyOne(id: string) {
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ corporate_email_verified: false })
      .eq("id", id);
    setMsg(error ? error.message : "Verificación anulada.");
    router.refresh();
  }

  // --- Acciones en lote (una sola consulta) ---
  function toggleAll(value: boolean) {
    setSelected(value ? Object.fromEntries(people.map((p) => [p.id, true])) : {});
  }

  async function bulkSetVerified(value: boolean) {
    setMsg(null);
    if (selectedIds.length === 0) {
      setMsg("Selecciona al menos una persona.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ corporate_email_verified: value })
      .in("id", selectedIds);
    setMsg(
      error
        ? error.message
        : value
        ? `${selectedIds.length} persona(s) verificada(s).`
        : `Verificación anulada a ${selectedIds.length} persona(s).`
    );
    setSelected({});
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
        <h2 className="text-sm font-semibold">Verificación del correo corporativo</h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={requireVerif}
            onChange={(e) => toggleRequireVerif(e.target.checked)}
          />
          <span>
            Exigir verificación del correo corporativo para votar.
            <span className="mt-1 block text-xs text-muted">
              Si está desactivado, se puede votar sin verificar el correo (el control recae en el
              código presencial de cada propuesta). Actívalo cuando el envío de correos esté listo.
            </span>
          </span>
        </label>
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
          seguridad para quien no reciba el código por email. Puedes marcar varias a la vez.
        </p>

        {/* Barra de acciones en lote */}
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-black/[0.03] px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Seleccionar todos
          </label>
          <span className="text-xs text-muted">({selectedIds.length} seleccionadas)</span>
          <div className="ml-auto flex gap-2">
            <button className="btn-brand" onClick={() => bulkSetVerified(true)}>
              Verificar seleccionadas
            </button>
            <button className="btn-outline" onClick={() => bulkSetVerified(false)}>
              Anular seleccionadas
            </button>
          </div>
        </div>

        <div className="divide-y divide-black/5">
          {people.map((p) => (
            <div key={p.id} className="space-y-2 py-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!selected[p.id]}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [p.id]: e.target.checked }))
                  }
                  aria-label={`Seleccionar ${p.full_name || "persona"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.full_name || "(sin nombre)"}</p>
                  <p className="truncate text-xs text-muted">{p.account_email}</p>
                  <p className="truncate text-xs text-muted">
                    {p.corporate_email ? `Corp: ${p.corporate_email} · ` : ""}
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

              <div className="flex flex-wrap items-center gap-2 pl-7">
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
                  <button className="btn-outline" onClick={() => unverifyOne(p.id)}>
                    Anular
                  </button>
                ) : (
                  <button className="btn-brand" onClick={() => verifyOne(p.id)}>
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
