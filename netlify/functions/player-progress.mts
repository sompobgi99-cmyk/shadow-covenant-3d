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
const PET_IDS = new Set([
  "lumo_wisp",
  "lantern_bunny",
  "tiny_gargoyle",
  "storm_pup",
  "grave_kitten",
  "mini_mimic",
  "imperial_phoenix",
  "chonky_tiger",
]);
const PACT_IDS = new Set([
  "blood_moon",
  "glass_soul",
  "cursed_economy",
  "no_mercy",
  "ravenous_horde",
]);
const PET_PRICES: Record<string, number> = {
  lumo_wisp: 1200,
  lantern_bunny: 1600,
  tiny_gargoyle: 2200,
  storm_pup: 2800,
  grave_kitten: 3600,
  mini_mimic: 4500,
};
const PET_RETRO_DEDUCT_ID = "petRetroDeduct20260708";
const PET_RETRO_DEDUCT_START = Date.parse("2026-07-07T17:00:00.000Z"); // 2026-07-08 00:00 Thailand
const PET_RETRO_DEDUCT_END = Date.parse("2026-07-08T17:00:00.000Z");   // 2026-07-09 00:00 Thailand
const SOUL_COIN_COMPENSATION_ID = "soulCoinCompensation20260709";

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

function cleanCoins(value: unknown) {
  const n = Math.floor(Number(value || 0));
  return Number.isFinite(n) && n > 0 ? Math.min(9999999, n) : 0;
}

function cleanPetState(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const ownedSrc = src.owned && typeof src.owned === "object" ? src.owned as Record<string, unknown> : {};
  const owned: Record<string, string> = {};
  for (const [id, value] of Object.entries(ownedSrc)) {
    if (!PET_IDS.has(id)) continue;
    const t = String(value || "").slice(0, 40);
    const parsed = Date.parse(t);
    owned[id] = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
  const selected = PET_IDS.has(String(src.selected || "")) && owned[String(src.selected || "")] ? String(src.selected || "") : "";
  return { owned, selected };
}

function cleanDateMap(input: unknown, allowed: Set<string>) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(src)) {
    if (!allowed.has(id)) continue;
    const t = String(value || "").slice(0, 40);
    const parsed = Date.parse(t);
    out[id] = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
  return out;
}

function cleanPactState(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const doneSrc = src.done && typeof src.done === "object" ? src.done as Record<string, unknown> : src;
  const normal = doneSrc.normal || doneSrc.hard ? cleanDateMap(doneSrc.normal, PACT_IDS) : cleanDateMap(doneSrc, PACT_IDS);
  const hard = cleanDateMap(doneSrc.hard, PACT_IDS);
  return { done: { normal, hard } };
}

function cleanMigrations(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(src)) {
    if (id !== PET_RETRO_DEDUCT_ID && id !== SOUL_COIN_COMPENSATION_ID) continue;
    const t = String(value || "").slice(0, 40);
    const parsed = Date.parse(t);
    out[id] = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
  return out;
}

function cleanMailboxMap(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const out: Record<string, string> = {};
  for (const [rawId, value] of Object.entries(src).slice(0, 100)) {
    const id = cleanId(rawId);
    if (!id || id.length > 80) continue;
    const parsed = Date.parse(String(value || "").slice(0, 40));
    out[id] = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  }
  return out;
}

function cleanMailbox(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return { read: cleanMailboxMap(src.read), claimed: cleanMailboxMap(src.claimed) };
}

function mergeMailbox(a: ReturnType<typeof cleanMailbox>, b: ReturnType<typeof cleanMailbox>) {
  const out = { read: { ...a.read }, claimed: { ...a.claimed } };
  for (const kind of ["read", "claimed"] as const) {
    for (const [id, at] of Object.entries(b[kind])) {
      if (!out[kind][id] || Date.parse(at) < Date.parse(out[kind][id])) out[kind][id] = at;
    }
  }
  return out;
}

function mergePacts(a: ReturnType<typeof cleanPactState>, b: ReturnType<typeof cleanPactState>) {
  const out = { done: { normal: { ...a.done.normal }, hard: { ...a.done.hard } } };
  for (const diff of ["normal", "hard"] as const) {
    for (const [id, at] of Object.entries(b.done[diff])) {
      if (!out.done[diff][id] || Date.parse(at) < Date.parse(out.done[diff][id])) out.done[diff][id] = at;
    }
  }
  return out;
}

function mergePets(a: ReturnType<typeof cleanPetState>, b: ReturnType<typeof cleanPetState>) {
  const owned = { ...a.owned };
  let added = false;
  for (const [id, at] of Object.entries(b.owned)) {
    if (!owned[id]) added = true;
    if (!owned[id] || Date.parse(at) < Date.parse(owned[id])) owned[id] = at;
  }
  const selected = b.selected && owned[b.selected] ? b.selected : a.selected && owned[a.selected] ? a.selected : "";
  return { pets: { owned, selected }, added };
}

async function readProgress(store: ReturnType<typeof getStore>, userId: string) {
  const data = await store.get(progressKey(userId), { type: "json" });
  const obj = data && typeof data === "object" ? data as { done?: unknown; pacts?: unknown; soulCoins?: unknown; pets?: unknown; mailbox?: unknown; migrations?: unknown; updated_at?: string } : {};
  return {
    done: cleanDone(obj.done),
    pacts: cleanPactState(obj.pacts),
    soulCoins: cleanCoins(obj.soulCoins),
    pets: cleanPetState(obj.pets),
    mailbox: cleanMailbox(obj.mailbox),
    migrations: cleanMigrations(obj.migrations),
    updated_at: obj.updated_at || "",
  };
}

function applyPetRetroDeduction(progress: Awaited<ReturnType<typeof readProgress>>) {
  if (progress.migrations[PET_RETRO_DEDUCT_ID]) return { progress, changed: false, deducted: 0 };
  let deducted = 0;
  for (const [id, at] of Object.entries(progress.pets.owned)) {
    const boughtAt = Date.parse(at);
    if (!Number.isFinite(boughtAt) || boughtAt < PET_RETRO_DEDUCT_START || boughtAt >= PET_RETRO_DEDUCT_END) continue;
    deducted += PET_PRICES[id] || 0;
  }
  const next = {
    ...progress,
    soulCoins: Math.max(0, progress.soulCoins - deducted),
    migrations: { ...progress.migrations, [PET_RETRO_DEDUCT_ID]: new Date().toISOString() },
  };
  return { progress: next, changed: true, deducted };
}

function applyProgressMigrations(progress: Awaited<ReturnType<typeof readProgress>>) {
  const retro = applyPetRetroDeduction(progress);
  return {
    progress: retro.progress,
    changed: retro.changed,
    deducted: retro.deducted,
    compensation: 0,
  };
}

export default async (req: Request) => {
  const auth = await verifySupabaseUser(req);
  if (auth.error) return json({ error: auth.error }, 401);
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const result = applyProgressMigrations(await readProgress(store, auth.userId));
    const progress = result.progress;
    if (result.changed) {
      await store.setJSON(progressKey(auth.userId), { done: progress.done, pacts: progress.pacts, soulCoins: progress.soulCoins, pets: progress.pets, mailbox: progress.mailbox, migrations: progress.migrations, updated_at: new Date().toISOString() });
    }
    return json({ ok: true, done: progress.done, pacts: progress.pacts, soulCoins: progress.soulCoins, pets: progress.pets, mailbox: progress.mailbox, migrations: progress.migrations, updated_at: progress.updated_at, retroPetDeducted: result.deducted, compensationSoulCoins: result.compensation });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const contentLength = Number.parseInt(req.headers.get("content-length") || "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
    let body: { done?: unknown; pacts?: unknown; soulCoins?: unknown; pets?: unknown; mailbox?: unknown; migrations?: unknown; coinSpend?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const incomingMigrations = cleanMigrations(body.migrations);
    const rawExisting = await readProgress(store, auth.userId);
    const migrationAwareExisting = incomingMigrations[SOUL_COIN_COMPENSATION_ID]
      ? { ...rawExisting, migrations: { ...rawExisting.migrations, [SOUL_COIN_COMPENSATION_ID]: incomingMigrations[SOUL_COIN_COMPENSATION_ID] } }
      : rawExisting;
    const existingResult = applyProgressMigrations(migrationAwareExisting);
    const existing = existingResult.progress;
    const merged = mergeDone(existing.done, cleanDone(body.done));
    const pacts = mergePacts(existing.pacts, cleanPactState(body.pacts));
    const incomingPets = cleanPetState(body.pets);
    const petMerge = mergePets(existing.pets, incomingPets);
    const mailbox = mergeMailbox(existing.mailbox, cleanMailbox(body.mailbox));
    const incomingCoins = Object.prototype.hasOwnProperty.call(body, "soulCoins") ? cleanCoins(body.soulCoins) : existing.soulCoins;
    const coinSpend = body.coinSpend === true;
    const soulCoins = coinSpend || (petMerge.added && incomingCoins < existing.soulCoins) ? incomingCoins : Math.max(existing.soulCoins, incomingCoins);
    const payload = { done: merged, pacts, soulCoins, pets: petMerge.pets, mailbox, migrations: existing.migrations, updated_at: new Date().toISOString() };
    await store.setJSON(progressKey(auth.userId), payload);
    return json({ ok: true, done: payload.done, pacts: payload.pacts, soulCoins: payload.soulCoins, pets: payload.pets, mailbox: payload.mailbox, migrations: payload.migrations, updated_at: payload.updated_at, retroPetDeducted: existingResult.deducted, compensationSoulCoins: existingResult.compensation });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/player-progress",
  method: ["GET", "POST", "PUT"],
};
