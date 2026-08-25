/**
 * Creates tables via Supabase SQL API (when available) or reports next steps.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const schemaPath = join(root, "supabase", "migrations", "001_schema.sql");
const seedPath = join(root, "supabase", "seed.sql");

async function tableExists() {
  const { error } = await supabase.from("orders").select("id").limit(1);
  if (!error) return true;
  if (error.code === "PGRST205" || error.message?.includes("does not exist")) return false;
  console.log("Orders check:", error.message);
  return false;
}

async function runSqlViaManagement(sql) {
  const ref = url.replace("https://", "").split(".")[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function main() {
  console.log("Supabase URL:", url);

  if (await tableExists()) {
    console.log("Tables already exist. Seeding if needed…");
    const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
    if (count === 0) {
      console.log("No orders — run seed in SQL Editor: supabase/seed.sql");
    } else {
      console.log(`Found ${count} order(s). Ready.`);
    }
    return;
  }

  console.log("Tables not found. Trying SQL via API…");

  const schema = readFileSync(schemaPath, "utf8");
  const seed = readFileSync(seedPath, "utf8");

  const mgmt = await runSqlViaManagement(schema);
  if (mgmt.ok) {
    console.log("Schema applied via management API.");
    const seedRes = await runSqlViaManagement(seed);
    if (seedRes.ok) console.log("Seed applied.");
    else console.log("Seed failed — run supabase/seed.sql in SQL Editor.");
    return;
  }

  console.log("\nCould not run SQL automatically (need database password).");
  console.log("Option A — Supabase Dashboard → SQL Editor, paste and run:");
  console.log("  1) supabase/migrations/001_schema.sql");
  console.log("  2) supabase/seed.sql");
  console.log("\nOption B — add SUPABASE_DB_URL to .env.local then:");
  console.log("  node scripts/setup-database.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
