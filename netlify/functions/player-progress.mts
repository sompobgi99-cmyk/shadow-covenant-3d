import { getStore } from "@netlify/blobs";

const STORE_NAME = "shadow-covenant-progress";
const MAX_BODY_BYTES = 8192;
const ACHIEVEMENT_IDS = new Set([
  "first_hunt",
  "level_10",
  "map2_reached",
  "first_evolution",
  "swift_survivor",
  "assassin_trial",
  "soul_collector",
  "shop_regular",
  "rich_striker",
  "map3_reached",
  "void_cleared",
]);

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function cleanId(value: unknown) {
  return String(value || "").replace(/[^\w.-]/g, "").slice(0, 80);
}

function supabaseEnv() {
  return {
    url: (Netlify.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, ""),
    anonKey: (Netlify.env.get("SUPABASE_ANON_KEY") || "").trim(),
  };
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function verifySupabaseUser(req: Request) {
  const token = bearerToken(req);
  if (!token) return { userId: "", error: "Login is required" };
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return { userId: "", error: "Auth is not configured on the server" };
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return { userId: "", error: "Login session is invalid or expired" };
    const data = await res.json();
    const userId = cleanId(data && data.id);
    if (!userId) return { userId: "", error: "Login session is missing a user id" };
    return { userId, error: "" };
  } catch {
    return { userId: "", error: "Unable to verify login session" };
  }
}

function progressKey(userId: string) {
  return `progress-v1-${userId}`;
}

function cleanDone(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const done: Record<string, string> = {};
  for (const [id, value] of Object.entries(src)) {
    if (!ACHIEVEMENT_IDS.has(id)) continue;
    const t = String(value || "").slice(0, 40);
    const parsed = Date.parse(t);
    done[id] = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
  return done;
}

function mergeDone(a: Record<string, string>, b: Record<string, string>) {
  const out = { ...a };
  for (const [id, at] of Object.entries(b)) {
    if (!out[id] || Date.parse(at) < Date.parse(out[id])) out[id] = at;
  }
  return out;
}

async function readProgress(store: ReturnType<typeof getStore>, userId: string) {
  const data = await store.get(progressKey(userId), { type: "json" });
  const obj = data && typeof data === "object" ? data as { done?: unknown; updated_at?: string } : {};
  return {
    done: cleanDone(obj.done),
    updated_at: obj.updated_at || "",
  };
}

export default async (req: Request) => {
  const auth = await verifySupabaseUser(req);
  if (auth.error) return json({ error: auth.error }, 401);
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const progress = await readProgress(store, auth.userId);
    return json({ ok: true, done: progress.done, updated_at: progress.updated_at });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const contentLength = Number.parseInt(req.headers.get("content-length") || "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
    let body: { done?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const existing = await readProgress(store, auth.userId);
    const merged = mergeDone(existing.done, cleanDone(body.done));
    const payload = { done: merged, updated_at: new Date().toISOString() };
    await store.setJSON(progressKey(auth.userId), payload);
    return json({ ok: true, done: payload.done, updated_at: payload.updated_at });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/player-progress",
  method: ["GET", "POST", "PUT"],
};
