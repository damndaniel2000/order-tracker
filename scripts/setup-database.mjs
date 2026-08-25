/**
 * Applies schema + seed to Supabase Postgres.
 * Requires SUPABASE_DB_URL in .env.local (Database → Connection string → URI)
 *   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

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

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "Missing SUPABASE_DB_URL in .env.local\n" +
      "Add your Postgres connection string from Supabase Dashboard → Project Settings → Database → Connection string (URI)."
  );
  process.exit(1);
}

const schema = readFileSync(
  join(root, "supabase", "migrations", "001_schema.sql"),
  "utf8"
);
const seed = readFileSync(join(root, "supabase", "seed.sql"), "utf8");

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log("Connected. Running schema…");
  await client.query(schema);
  console.log("Schema applied. Running seed…");
  await client.query(seed);
  console.log("Seed applied. Done.");
  await client.end();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
