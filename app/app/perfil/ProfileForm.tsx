"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, WorkCenter } from "@/lib/types";

export default function ProfileForm({
  profile,
  centers,
  email,
}: {
  profile: Profile;
  centers: WorkCenter[];
  email: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [centerId, setCenterId] = useState(profile.work_center_id ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, work_center_id: centerId || null })
      .eq("id", profile.id);
    setMsg(error ? error.message : "Guardado.");
    router.refresh();
  }

  async function confirmToken() {
    setVerifyMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("confirm_corporate_verification", {
      p_token: token.trim(),
    });
    setVerifyMsg(error ? error.message : "Correo corporativo verificado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <label className="text-xs font-medium text-muted">Correo de acceso</label>
          <p className="text-sm">{email}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="fn">Nombre y apellidos</label>
          <input id="fn" className="input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="wc">Centro de trabajo</label>
          <select id="wc" className="input mt-1" value={centerId} onChange={(e) => setCenterId(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button className="btn-brand" onClick={save}>Guardar cambios</button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">Correo corporativo</h2>
        {profile.corporate_email_verified ? (
          <p className="rounded-md bg-favor/10 px-3 py-2 text-sm text-favor">
            Verificado{profile.corporate_email ? `: ${profile.corporate_email}` : ""}.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Recibirás un código en tu correo de empresa. Introdúcelo aquí para acreditarte como
              empleada y poder votar. (El envío del código lo hará la Edge Function de verificación.)
            </p>
            <input
              className="input"
              placeholder="Código de verificación"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button className="btn-outline" onClick={confirmToken}>Verificar</button>
            {verifyMsg && <p className="text-sm text-muted">{verifyMsg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
