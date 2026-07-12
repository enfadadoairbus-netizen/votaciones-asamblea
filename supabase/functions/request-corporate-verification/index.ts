// =====================================================================
// Edge Function: request-corporate-verification
// ---------------------------------------------------------------------
// Genera y ENVÍA por correo el código de verificación corporativa.
//   1. Autentica al usuario por su JWT (verify_jwt).
//   2. Llama al RPC issue_corporate_verification (service_role): valida el
//      dominio, comprueba unicidad, guarda el hash del código y lo devuelve
//      EN CLARO solo aquí (servidor). El código nunca vuelve al navegador.
//   3. Envía el código SOLO al correo corporativo (proveedor: Resend).
//
// Secrets requeridos (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (inyectados por la plataforma)
//   RESEND_API_KEY   -> clave del proveedor de email
//   MAIL_FROM        -> remitente, p.ej. "Asamblea <no-reply@tudominio.com>"
// =====================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente con el JWT del usuario: solo para identificarlo.
  const asUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "No autenticado" }, 401);

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.corporate_email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }
  if (!email) return json({ error: "Falta el correo corporativo" }, 400);

  // Cliente service_role: genera y guarda el código de forma controlada.
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: code, error: rpcErr } = await admin.rpc(
    "issue_corporate_verification",
    { p_profile_id: user.id, p_email: email },
  );
  if (rpcErr) return json({ error: rpcErr.message }, 400);

  // Envío del correo (solo al corporativo). El código nunca vuelve al cliente.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") ?? "Asamblea <onboarding@resend.dev>";
  if (!resendKey) {
    return json(
      { error: "El envío de correo no está configurado (RESEND_API_KEY)." },
      500,
    );
  }

  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Tu código de verificación — Votaciones de Asamblea",
      text:
        `Tu código de verificación es: ${code}\n\n` +
        `Introdúcelo en tu perfil para acreditar tu correo corporativo y poder votar.\n` +
        `El código caduca en 15 minutos. Si no has solicitado esto, ignora este correo.`,
    }),
  });

  if (!mail.ok) {
    const detail = await mail.text();
    console.error("Fallo al enviar correo:", detail);
    return json({ error: "No se pudo enviar el correo de verificación." }, 502);
  }

  return json({ ok: true });
});
