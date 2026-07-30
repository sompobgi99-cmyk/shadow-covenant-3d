import { mkdir, writeFile } from "node:fs/promises";

const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "");
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) before backing up.");

const rows = [];
for (let offset = 0; ; offset += 1000) {
  const res = await fetch(`${url}/rest/v1/player_progress?select=*&order=user_id&limit=1000&offset=${offset}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase backup failed (${res.status}): ${await res.text()}`);
  const batch = await res.json();
  if (!Array.isArray(batch) || batch.length === 0) break;
  rows.push(...batch);
  if (batch.length < 1000) break;
}

await mkdir("backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = `backups/player-progress-${stamp}.json`;
await writeFile(file, JSON.stringify({ exportedAt: new Date().toISOString(), rowCount: rows.length, rows }, null, 2));
console.log(`Player progress backup written: ${file} (${rows.length} rows)`);
