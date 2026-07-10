import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WorkCenter, Profile } from "@/lib/types";
import CreateForm from "./CreateForm";

export const dynamic = "force-dynamic";

export default async function CrearPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single<Pick<Profile, "role">>();

  if (profile?.role !== "organizer" && profile?.role !== "admin") redirect("/app/votaciones");

  const { data: centers } = await supabase
    .from("work_centers")
    .select("id, name, code")
    .order("name")
    .returns<WorkCenter[]>();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Crear propuesta</h1>
      <CreateForm centers={centers ?? []} />
    </div>
  );
}
