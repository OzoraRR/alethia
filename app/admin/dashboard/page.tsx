import { redirect } from "next/navigation";
import { AdminDashboard } from "@/features/admin/admin-dashboard";
import { callAdminRpc, getAdminSession, getAdminToken } from "@/lib/admin/server";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin");
  const token = await getAdminToken();
  const [reports, modules, quests] = await Promise.all([
    callAdminRpc<Record<string, unknown>[]>("admin_list_reports", { requested_token: token }),
    callAdminRpc<Record<string, unknown>[]>("admin_list_modules", { requested_token: token }),
    callAdminRpc<Record<string, unknown>[]>("admin_list_quests", { requested_token: token }),
  ]);
  return <AdminDashboard initialModules={modules ?? []} initialQuests={quests ?? []} initialReports={reports ?? []} username={session.username} />;
}
