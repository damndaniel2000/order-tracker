import pg from "pg";
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
const ref = "rkbfsggvnybdhnzwcygg";

const urls = [
  `postgresql://postgres.${ref}:${encodeURIComponent(secret)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${ref}:${encodeURIComponent(secret)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${ref}:${encodeURIComponent(secret)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${encodeURIComponent(secret)}@db.${ref}.supabase.co:5432/postgres`,
  `postgresql://postgres.${ref}:${encodeURIComponent(secret)}@db.${ref}.supabase.co:5432/postgres`,
];

for (const u of urls) {
  const c = new pg.Client({ connectionString: u, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const r = await c.query("select 1 as ok");
    console.log("OK", u.replace(secret, "***"), r.rows);
    await c.end();
    break;
  } catch (e) {
    console.log("FAIL", u.split("@")[1]?.split("/")[0], e.message.split("\n")[0]);
    try {
      await c.end();
    } catch {}
  }
}
