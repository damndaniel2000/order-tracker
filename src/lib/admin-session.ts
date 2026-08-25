import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "lamatic_admin_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function getSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ?? "lamatic-dev-session-secret-change-me"
  );
}

export function createAdminToken(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${email}:${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyAdminToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 3) return null;
    const sig = parts.pop()!;
    const exp = Number(parts.pop());
    const email = parts.join(":");
    const payload = `${email}:${exp}`;
    const expected = createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return email;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE };
