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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sql = "SELECT 1 as ok";

const endpoints = [
  `${url}/pg`,
  `${url}/pg/query`,
  `${url}/sql`,
  `${url}/database/query`,
  `https://api.supabase.com/v1/projects/rkbfsggvnybdhnzwcygg/database/query`,
];

for (const ep of endpoints) {
  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    console.log(ep, res.status, text.slice(0, 120));
  } catch (e) {
    console.log(ep, "ERR", e.message);
  }
}
