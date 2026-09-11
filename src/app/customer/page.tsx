import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyCustomerToken } from "@/lib/customer-session";
import { SiteHeader } from "@/components/SiteHeader";
import { CustomerDashboard } from "@/components/CustomerDashboard";

export default async function CustomerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const customerId = token ? verifyCustomerToken(token) : null;

  if (!customerId) {
    redirect("/customer/login");
  }

  return (
    <>
      <SiteHeader />
      <CustomerDashboard />
    </>
  );
}
