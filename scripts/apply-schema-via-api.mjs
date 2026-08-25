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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ref = "rkbfsggvnybdhnzwcygg";
const sql = readFileSync(join(root, "supabase", "setup-all.sql"), "utf8");

const platformUrls = [
  `https://api.supabase.com/platform/pg-meta/${ref}/query`,
  `https://supabase.com/platform/pg-meta/${ref}/query`,
  `${url}/platform/pg-meta/${ref}/query`,
  `${url}/pg-meta/v1/query`,
  `${url}/pg-meta/query`,
];

const headerSets = [
  { apikey: secret, Authorization: `Bearer ${secret}` },
  { apikey: secret },
  { Authorization: `Bearer ${secret}` },
];

for (const u of platformUrls) {
  for (const h of headerSets) {
    const res = await fetch(u, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "SELECT 1 as ok" }),
    });
    const text = await res.text();
    if (res.status !== 404) {
      console.log(u, Object.keys(h), res.status, text.slice(0, 150));
    }
  }
}
