import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminOverview } from "@/features/support/components/admin-overview";
import { getCurrentUser } from "@/server/auth/session";

export default async function AdminPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/admin/login");
  if (current.user.systemRole === "DISPUTE_ADMIN") redirect("/admin/disputes");
  if (!["SUPPORT", "SUPER_ADMIN"].includes(current.user.systemRole))
    redirect("/admin/login?unauthorized=1");
  return (
    <AdminShell active="dashboard">
      <AdminOverview />
    </AdminShell>
  );
}
