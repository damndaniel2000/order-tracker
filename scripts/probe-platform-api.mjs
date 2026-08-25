import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0 && !process.env[t.slice(0, i).trim()])
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = "rkbfsggvnybdhnzwcygg";

const paths = [
  `/v1/projects/${ref}`,
  `/v1/projects/${ref}/api-keys`,
  `/v1/projects/${ref}/config/database`,
  `/v1/projects/${ref}/config/database/postgres`,
  `/platform/projects/${ref}/config/database`,
  `/platform/projects/${ref}/settings`,
  `/platform/projects/${ref}/api-keys`,
];

for (const p of paths) {
  for (const base of ["https://api.supabase.com", "https://supabase.com"]) {
    const res = await fetch(`${base}${p}`, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    });
    if (res.status !== 404) {
      const t = await res.text();
      console.log(base + p, res.status, t.slice(0, 120));
    }
  }
}

// Try database/query with publishable + secret combo per docs
const q = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    apikey: publishable,
    Authorization: `Bearer ${publishable}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: "select 1" }),
});
console.log("query with publishable", q.status, (await q.text()).slice(0, 120));

const q2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: "select 1" }),
});
console.log("query with secret", q2.status, (await q2.text()).slice(0, 120));
