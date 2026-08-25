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

const ref = "rkbfsggvnybdhnzwcygg";
const pwd = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY;

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "eu-central-2",
  "eu-north-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
  "sa-east-1",
];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const url = `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@${host}:6543/postgres`;
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const r = await c.query("select 1 as ok");
    console.log("SUCCESS region:", region, r.rows);
    await c.end();
    process.exit(0);
  } catch (e) {
    const msg = e.message.split("\n")[0];
    if (!msg.includes("Tenant or user not found") && !msg.includes("ENOTFOUND")) {
      console.log(region, msg);
    }
    try {
      await c.end();
    } catch {}
  }
}
console.log("No pooler region matched with provided password/key");
