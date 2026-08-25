/**
 * Attempts to apply schema via Supabase HTTP APIs using project secret key.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ref = "rkbfsggvnybdhnzwcygg";

const sql = readFileSync(join(root, "supabase", "setup-all.sql"), "utf8");

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

const endpoints = [
  {
    name: "management-query-bearer",
    url: `https://api.supabase.com/v1/projects/${ref}/database/query`,
    headers,
    body: { query: "SELECT 1" },
  },
  {
    name: "management-query-apikey-only",
    url: `https://api.supabase.com/v1/projects/${ref}/database/query`,
    headers: { apikey: secret, "Content-Type": "application/json" },
    body: { query: "SELECT 1" },
  },
  {
    name: "project-pg",
    url: `${url}/pg/query`,
    headers,
    body: { query: "SELECT 1" },
  },
  {
    name: "project-sql",
    url: `${url}/sql`,
    headers,
    body: { query: "SELECT 1" },
  },
  {
    name: "rest-rpc-exec",
    url: `${url}/rest/v1/rpc/exec_sql`,
    headers,
    body: { query: "SELECT 1" },
  },
];

async function probe() {
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: ep.headers,
        body: JSON.stringify(ep.body),
      });
      const text = await res.text();
      console.log(`[${ep.name}] ${res.status}`, text.slice(0, 200));
    } catch (e) {
      console.log(`[${ep.name}] ERR`, e.message);
    }
  }
}

async function tryLegacyJwt() {
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: secret },
  });
  console.log("[auth health]", res.status, await res.text());

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.from("orders").select("id").limit(1);
  console.log("[rest orders]", error?.code ?? "ok", error?.message ?? data);
}

async function applyViaManagement() {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  console.log("[apply full sql]", res.status, (await res.text()).slice(0, 500));
}

console.log("Probing endpoints...\n");
await probe();
console.log("\nSupabase client check...\n");
await tryLegacyJwt();
console.log("\nTrying full SQL apply...\n");
await applyViaManagement();
