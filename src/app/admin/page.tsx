import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-session";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminDashboard } from "@/components/AdminDashboard";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const email = token ? verifyAdminToken(token) : null;

  if (!email) {
    redirect("/admin/login");
  }

  return (
    <>
      <SiteHeader />
      <AdminDashboard />
    </>
  );
}
