import { cookies } from "next/headers";
import { COOKIE_NAME, verifyCustomerToken } from "@/lib/customer-session";

export async function requireCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyCustomerToken(token) : null;
}
