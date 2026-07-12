import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WorkCenter, Profile, AdminPerson } from "@/lib/types";
import AdminPanel from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single<Pick<Profile, "role">>();
  if (me?.role !== "admin") redirect("/app/votaciones");

  const { data: settings } = await supabase
    .from("settings")
    .select("allowed_domains")
    .eq("id", true)
    .maybeSingle<{ allowed_domains: string[] }>();

  const { data: centers } = await supabase
    .from("work_centers")
    .select("id, name, code")
    .order("name")
    .returns<WorkCenter[]>();

  const { data: peopleData } = await supabase.rpc("admin_list_people");
  const people = (peopleData ?? []) as AdminPerson[];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Administración</h1>
      <AdminPanel
        domains={settings?.allowed_domains ?? []}
        centers={centers ?? []}
        people={people}
      />
    </div>
  );
}
