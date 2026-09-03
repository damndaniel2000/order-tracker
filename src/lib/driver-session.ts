import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE = 60 * 60 * 12; // 12 hours

export type DriverSession = {
  id: string;
  username: string;
  displayName: string;
};

function getSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ?? "likhit-dev-session-secret-change-me"
  );
}

export function createDriverToken(session: DriverSession): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${session.id}:${session.username}:${session.displayName}:${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyDriverToken(token: string): DriverSession | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 5) return null;
    const sig = parts.pop()!;
    const exp = Number(parts.pop());
    const displayName = parts.pop()!;
    const username = parts.pop()!;
    const id = parts.join(":");
    const payload = `${id}:${username}:${displayName}:${exp}`;
    const expected = createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return { id, username, displayName };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export { MAX_AGE };
