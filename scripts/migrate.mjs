/**
 * Apply supabase/setup-all.sql using Postgres (pooler) or Management API.
 *
 * With project secret key only (sb_secret_*): cannot run DDL via REST — use one of:
 *   1) SUPABASE_DB_PASSWORD=your-db-password node scripts/migrate.mjs
 *   2) SUPABASE_DB_URL=postgresql://... node scripts/migrate.mjs
 *   3) SUPABASE_ACCESS_TOKEN=sbp_... node scripts/migrate.mjs  (Management API)
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ref = "rkbfsggvnybdhnzwcygg";

function loadEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0 && !process.env[t.slice(0, i).trim()])
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

loadEnv();

const sql = readFileSync(join(root, "supabase", "setup-all.sql"), "utf8");
const dbPassword =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ??
  process.env.SUPABASE_DB_PASSWORD;
const dbUrl = process.env.SUPABASE_DB_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

async function verifyTables() {
  const sb = createClient(url, secret);
  const { error } = await sb.from("orders").select("id").limit(1);
  return !error || error.code !== "PGRST205";
}

async function viaManagementApi() {
  if (!accessToken?.startsWith("sbp_")) {
    throw new Error("SUPABASE_ACCESS_TOKEN must be a personal access token (sbp_...)");
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text}`);
  console.log("Applied via Supabase Management API (database/query).");
}

async function viaPostgres(connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Applied via Postgres connection.");
}

async function viaPoolerPassword(password) {
  let lastErr;
  for (const region of regions) {
    const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    try {
      await viaPostgres(connectionString);
      console.log(`Connected via pooler region: ${region}`);
      return;
    } catch (e) {
      lastErr = e;
      if (!String(e.message).includes("Tenant or user not found")) {
        throw e;
      }
    }
  }
  throw lastErr ?? new Error("Could not connect to pooler in any region");
}

async function main() {
  console.log("Checking Supabase project…");
  if (await verifyTables()) {
    console.log("Tables already exist. Running seed-safe SQL anyway (idempotent where possible)…");
  }

  if (accessToken) {
    await viaManagementApi();
  } else if (dbUrl) {
    await viaPostgres(dbUrl);
  } else if (dbPassword) {
    await viaPoolerPassword(dbPassword);
  } else {
    console.error(`
Could not apply schema with sb_secret alone — Supabase Data API does not run CREATE TABLE.

Add ONE of these to .env.local then re-run:

  SUPABASE_DB_PASSWORD=your-database-password
  SUPABASE_DB_URL=postgresql://postgres.${ref}:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
  SUPABASE_ACCESS_TOKEN=sbp_...   (from https://supabase.com/dashboard/account/tokens)

Database password: Project Settings → Database → Database password
`);
    process.exit(1);
  }

  if (await verifyTables()) {
    const sb = createClient(url, secret);
    const { count } = await sb
      .from("orders")
      .select("*", { count: "exact", head: true });
    console.log(`Done. orders table ready (${count ?? 0} row(s)).`);
  } else {
    console.error("Migration ran but orders table still missing — check SQL errors above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
