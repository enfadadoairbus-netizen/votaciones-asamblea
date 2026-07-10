import { createClient } from "@/lib/supabase/server";
import type { Profile, WorkCenter } from "@/lib/types";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, work_center_id, corporate_email, corporate_email_verified, role")
    .eq("id", user!.id)
    .single<Profile>();

  const { data: centers } = await supabase
    .from("work_centers")
    .select("id, name, code")
    .order("name")
    .returns<WorkCenter[]>();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Perfil</h1>
      <ProfileForm profile={profile!} centers={centers ?? []} email={user!.email ?? ""} />
    </div>
  );
}
