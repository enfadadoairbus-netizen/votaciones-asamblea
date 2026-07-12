export type Role = "employee" | "organizer" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  work_center_id: string | null;
  corporate_email: string | null;
  corporate_email_verified: boolean;
  role: Role;
};

export type AdminPerson = Profile & { account_email: string };

export type WorkCenter = { id: string; name: string; code: string | null };

export type Proposal = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  requires_presence_code: boolean;
  status: "draft" | "active" | "closed";
};

export type ProposalStat = {
  scope: "global" | "center";
  work_center_id: string | null;
  work_center_name: string | null;
  up_count: number;
  down_count: number;
  participation_count: number;
};
