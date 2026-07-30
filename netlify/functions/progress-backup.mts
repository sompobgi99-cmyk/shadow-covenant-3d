import { getStore } from "@netlify/blobs";

const STORE_NAME = "shadow-covenant-progress-backups";
const PAGE_SIZE = 1000;

function env(name: string) {
  return (Netlify.env.get(name) || "").trim();
}

export function backupSlot(date = new Date()) {
  return `daily-${date.getUTCDay()}`;
}

async function readAllProgress() {
  const url = env("SUPABASE_URL").replace(/\/+$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("Supabase backup environment is not configured");
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      select: "*",
      order: "user_id",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const res = await fetch(`${url}/rest/v1/player_progress?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`Supabase backup failed (${res.status})`);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export default async () => {
  const rows = await readAllProgress();
  const exportedAt = new Date().toISOString();
  const backup = { schema: 1, exportedAt, rowCount: rows.length, rows };
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const metadata = { exportedAt, rowCount: rows.length };
  await Promise.all([
    store.setJSON(backupSlot(new Date()), backup, { metadata }),
    store.setJSON("latest", backup, { metadata }),
  ]);
  console.log(`Player progress scheduled backup complete: ${rows.length} rows at ${exportedAt}`);
  return new Response(JSON.stringify({ ok: true, rowCount: rows.length, exportedAt }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};

export const config = {
  schedule: "@daily",
};

export const progressBackupContract = { backupSlot };
