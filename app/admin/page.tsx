import { redirect } from "next/navigation";
import { AdminLogin } from "@/features/admin/admin-login";
import { getAdminSession } from "@/lib/admin/server";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin/dashboard");
  return <AdminLogin />;
}
