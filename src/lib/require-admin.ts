import { cookies } from "next/headers";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-session";

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyAdminToken(token) : null;
}
