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

  const [corpEmail, setCorpEmail] = useState(profile.corporate_email ?? "");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);

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

  async function sendCode() {
    setVerifyErr(null);
    setVerifyMsg(null);
    const email = corpEmail.trim().toLowerCase();
    if (!email) {
      setVerifyErr("Escribe tu correo corporativo.");
      return;
    }
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.functions.invoke("request-corporate-verification", {
      body: { corporate_email: email },
    });
    setSending(false);
    if (error) {
      // El cuerpo del error del edge trae el mensaje real (dominio no admitido, etc.)
      let detail = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          const body = await ctx.json();
          if (body?.error) detail = body.error;
        }
      } catch {
        /* usa el mensaje por defecto */
      }
      setVerifyErr(detail);
      return;
    }
    setCodeSent(true);
    setVerifyMsg(`Te hemos enviado un código a ${email}. Revisa tu correo de empresa.`);
  }

  async function confirmToken() {
    setVerifyErr(null);
    setVerifyMsg(null);
    if (!token.trim()) {
      setVerifyErr("Introduce el código que has recibido.");
      return;
    }
    setVerifying(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("confirm_corporate_verification", {
      p_token: token.trim(),
    });
    setVerifying(false);
    if (error) {
      setVerifyErr(error.message);
      return;
    }
    setVerifyMsg("Correo corporativo verificado. Ya puedes votar.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <label className="text-xs font-medium text-muted">Correo de acceso (personal)</label>
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
              Verifica tu correo de empresa para acreditarte como empleada y poder votar.
              Puedes hacerlo ahora o más adelante: te enviaremos un código a ese correo.
            </p>

            <div>
              <label className="text-xs font-medium text-muted" htmlFor="ce">Correo corporativo</label>
              <input
                id="ce"
                className="input mt-1"
                type="email"
                placeholder="nombre@empresa.com"
                value={corpEmail}
                onChange={(e) => setCorpEmail(e.target.value)}
              />
            </div>
            <button className="btn-brand" onClick={sendCode} disabled={sending}>
              {sending ? "Enviando…" : codeSent ? "Reenviar código" : "Enviar código"}
            </button>

            {codeSent && (
              <div className="space-y-2 border-t border-black/10 pt-3">
                <label className="text-xs font-medium text-muted" htmlFor="tk">Código de verificación</label>
                <input
                  id="tk"
                  className="input"
                  inputMode="numeric"
                  placeholder="6 dígitos"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button className="btn-outline" onClick={confirmToken} disabled={verifying}>
                  {verifying ? "Verificando…" : "Verificar"}
                </button>
              </div>
            )}

            {verifyMsg && <p className="text-sm text-favor">{verifyMsg}</p>}
            {verifyErr && <p className="text-sm text-contra">{verifyErr}</p>}
          </>
        )}
      </div>
    </div>
  );
}
