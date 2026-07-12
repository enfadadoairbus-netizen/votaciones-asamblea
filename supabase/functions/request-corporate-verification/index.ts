// =====================================================================
// Edge Function: request-corporate-verification
// ---------------------------------------------------------------------
// Genera y ENVÍA por correo el código de verificación corporativa.
//   1. Autentica al usuario por su JWT (verify_jwt).
//   2. Llama al RPC issue_corporate_verification (service_role): valida el
//      dominio, comprueba unicidad, guarda el hash del código y lo devuelve
//      EN CLARO solo aquí (servidor). El código nunca vuelve al navegador.
//   3. Envía el código SOLO al correo corporativo por SMTP de Gmail.
//
// Secrets requeridos (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (los pone la plataforma)
//   GMAIL_USER          -> la cuenta Gmail dedicada (p.ej. votaciones.comite@gmail.com)
//   GMAIL_APP_PASSWORD  -> contraseña de aplicación de Google (16 caracteres, sin espacios)
//   MAIL_FROM           -> opcional; remitente visible. Por defecto usa GMAIL_USER.
// =====================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

  // Envío del correo por SMTP de Gmail (solo al corporativo).
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
  const from = Deno.env.get("MAIL_FROM") ??
    (gmailUser ? `Votaciones Asamblea <${gmailUser}>` : "");
  if (!gmailUser || !gmailPass) {
    return json(
      { error: "El envío de correo no está configurado (GMAIL_USER/GMAIL_APP_PASSWORD)." },
      500,
    );
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: gmailUser, password: gmailPass },
    },
  });

  try {
    await client.send({
      from,
      to: email,
      subject: "Tu código de verificación — Votaciones de Asamblea",
      content:
        `Tu código de verificación es: ${code}\n\n` +
        `Introdúcelo en tu perfil para acreditar tu correo corporativo y poder votar.\n` +
        `El código caduca en 15 minutos. Si no has solicitado esto, ignora este correo.`,
    });
    await client.close();
  } catch (e) {
    console.error("Fallo al enviar correo (SMTP):", e);
    return json({ error: "No se pudo enviar el correo de verificación." }, 502);
  }

  return json({ ok: true });
});
