"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/", "layout");
  redirect("/app/votaciones");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("full_name") ?? "");
  const corporateEmail = String(formData.get("corporate_email") ?? "").trim().toLowerCase();
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        // Correo corporativo opcional: se guarda sin verificar; el empleado lo
        // verifica luego desde su perfil. La cuenta se crea con el correo personal.
        ...(corporateEmail ? { corporate_email: corporateEmail } : {}),
      },
    },
  });
  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }
  redirect("/login?message=" + encodeURIComponent("Revisa tu correo personal para confirmar la cuenta."));
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
