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

  const { data: settings } = await supabase
    .from("settings")
    .select("require_corporate_verification")
    .eq("id", true)
    .maybeSingle<{ require_corporate_verification: boolean }>();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Perfil</h1>
      <ProfileForm
        profile={profile!}
        centers={centers ?? []}
        email={user!.email ?? ""}
        requireVerification={settings?.require_corporate_verification ?? true}
      />
    </div>
  );
}
