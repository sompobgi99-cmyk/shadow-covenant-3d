import { getStore } from "@netlify/blobs";

const STORE_NAME = "shadow-covenant-progress";
const MAX_BODY_BYTES = 65536;
const ACHIEVEMENT_IDS = new Set([
  "first_hunt",
  "level_10",
  "bamboo_craving",
  "map2_reached",
  "first_evolution",
  "swift_survivor",
  "assassin_trial",
  "cursed_eye_trial",
  "soul_collector",
  "shop_regular",
  "rich_striker",
  "map3_reached",
  "butcher_hunted",
  "survive_3m",
  "survive_6m",
  "overtime_witness",
  "overtime_climber",
  "overtime_madness",
  "kill_300",
  "kill_1000",
  "kill_1500",
  "level_30",
  "level_45",
  "level_60_cap",
  "items_20",
  "items_30",
  "chests_12",
  "chests_20",
  "shops_10",
  "gold_1500",
  "gold_3000",
  "first_boss_kill",
  "boss_triple",
  "mini_3",
  "mini_8",
  "evolve_2",
  "full_armory",
  "no_damage_5m",
  "clean_clear",
  "normal_clear",
  "hard_clear",
  "pact_runner",
  "pact_stack",
  "pact_clear",
  "tax_evasion",
  "shopaholic_denial",
  "box_has_feelings",
  "walking_inventory",
  "one_more_level",
  "bonk_department",
  "boss_hr_complaint",
  "mini_boss_is_not_mini",
  "overtime_terms_unread",
  "still_here_why",
  "three_weapon_problem",
  "evolution_addict",
  "hard_mode_regret",
  "casual_research",
  "normal_person",
  "pact_fine_print",
  "glass_cannon_intern",
  "butcher_no_tip",
  "health_insurance_denied",
  "do_not_panic_much",
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
const DIVINE_OFFERING_IDS = new Set([
  "astra", "veyra", "morvane", "solarius", "nhal",
  "serapha", "fenrir", "tharos", "eirene", "midas",
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
    serviceKey: (Netlify.env.get("SUPABASE_SECRET_KEY") || Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim(),
  };
}

function postgresReady() {
  const { url, serviceKey } = supabaseEnv();
  return !!(url && serviceKey);
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

function cleanCoins(value: unknown) {
  const n = Math.floor(Number(value || 0));
  return Number.isFinite(n) && n > 0 ? Math.min(9999999, n) : 0;
}

function cleanCoinDelta(value: unknown) {
  const n = Math.trunc(Number(value || 0));
  return Number.isFinite(n) ? Math.max(-9999999, Math.min(9999999, n)) : 0;
}

function cleanMutationId(value: unknown) {
  return String(value || "").replace(/[^\w.-]/g, "").slice(0, 80);
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

function cleanDivineOfferingState(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return { owned: cleanDateMap(src.owned, DIVINE_OFFERING_IDS) };
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
  return { read: cleanMailboxMap(src.read), claimed: cleanMailboxMap(src.claimed), deleted: cleanMailboxMap(src.deleted) };
}

function cleanChallengeRewards(input: unknown) {
  const src = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(src).slice(0, 200)) {
    if (!/^(daily:\d{4}-\d{2}-\d{2}|weekly:\d{4}-W\d{2})$/.test(id)) continue;
    const parsed = Date.parse(String(value || "").slice(0, 40));
    if (Number.isFinite(parsed)) out[id] = new Date(parsed).toISOString();
  }
  return out;
}

async function readLegacyProgress(store: ReturnType<typeof getStore>, userId: string) {
  const data = await store.get(progressKey(userId), { type: "json" });
  const obj = data && typeof data === "object" ? data as { done?: unknown; pacts?: unknown; soulCoins?: unknown; pets?: unknown; divineOfferings?: unknown; challengeRewards?: unknown; mailbox?: unknown; migrations?: unknown; updated_at?: string } : {};
  return {
    done: cleanDone(obj.done),
    pacts: cleanPactState(obj.pacts),
    soulCoins: cleanCoins(obj.soulCoins),
    pets: cleanPetState(obj.pets),
    divineOfferings: cleanDivineOfferingState(obj.divineOfferings),
    challengeRewards: cleanChallengeRewards(obj.challengeRewards),
    mailbox: cleanMailbox(obj.mailbox),
    migrations: cleanMigrations(obj.migrations),
    updated_at: obj.updated_at || "",
  };
}

function applyPetRetroDeduction(progress: Awaited<ReturnType<typeof readLegacyProgress>>) {
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

function applyProgressMigrations(progress: Awaited<ReturnType<typeof readLegacyProgress>>) {
  const retro = applyPetRetroDeduction(progress);
  return {
    progress: retro.progress,
    changed: retro.changed,
    deducted: retro.deducted,
    compensation: 0,
  };
}

function cleanProgressPayload(body: Record<string, unknown>) {
  return {
    done: cleanDone(body.done),
    pacts: cleanPactState(body.pacts),
    pets: cleanPetState(body.pets),
    divineOfferings: cleanDivineOfferingState(body.divineOfferings),
    challengeRewards: cleanChallengeRewards(body.challengeRewards),
    mailbox: cleanMailbox(body.mailbox),
    migrations: cleanMigrations(body.migrations),
  };
}

function postgresProgress(row: Record<string, unknown>) {
  return {
    ok: true,
    done: cleanDone(row.done),
    pacts: cleanPactState(row.pacts),
    soulCoins: cleanCoins(row.soul_coins ?? row.soulCoins),
    pets: cleanPetState(row.pets),
    divineOfferings: cleanDivineOfferingState(row.divine_offerings ?? row.divineOfferings),
    challengeRewards: cleanChallengeRewards(row.challenge_rewards ?? row.challengeRewards),
    mailbox: cleanMailbox(row.mailbox),
    migrations: cleanMigrations(row.migrations),
    revision: Math.max(0, Math.trunc(Number(row.revision || 0))),
    updated_at: String(row.updated_at || ""),
    mutationApplied: Object.prototype.hasOwnProperty.call(row, "mutationApplied") ? row.mutationApplied !== false : undefined,
    storage: "postgres",
  };
}

async function postgresRequest(path: string, init: RequestInit = {}) {
  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) throw new Error("Supabase Postgres is not configured");
  const headers = {
    apikey: serviceKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
}

async function postgresError(res: Response, action: string) {
  let detail = "";
  try { detail = String(await res.text()).replace(/\s+/g, " ").slice(0, 320); } catch {}
  return new Error(`Supabase ${action} failed (${res.status})${detail ? `: ${detail}` : ""}`);
}

async function readPostgresProgress(userId: string) {
  const params = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: "user_id,soul_coins,done,pacts,pets,divine_offerings,challenge_rewards,mailbox,migrations,revision,updated_at",
    limit: "1",
  });
  const res = await postgresRequest(`player_progress?${params.toString()}`, { method: "GET" });
  if (!res.ok) throw await postgresError(res, "player progress read");
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? postgresProgress(rows[0]) : null;
}

async function mergePostgresProgress(userId: string, mutationId: string, coinDelta: number, progress: ReturnType<typeof cleanProgressPayload>) {
  const res = await postgresRequest("rpc/merge_player_progress", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId,
      p_mutation_id: mutationId,
      p_soul_coin_delta: coinDelta,
      p_progress: progress,
    }),
  });
  if (!res.ok) throw await postgresError(res, "player progress merge");
  const result = await res.json();
  return postgresProgress(result && typeof result === "object" ? result as Record<string, unknown> : {});
}

async function ensureBlobProgressMigrated(store: ReturnType<typeof getStore>, userId: string) {
  const existing = await readPostgresProgress(userId);
  if (existing) return { progress: existing, migrated: false, deducted: 0 };
  const legacyResult = applyProgressMigrations(await readLegacyProgress(store, userId));
  const legacy = legacyResult.progress;
  const payload = cleanProgressPayload({
    done: legacy.done,
    pacts: legacy.pacts,
    pets: legacy.pets,
    divineOfferings: legacy.divineOfferings,
    challengeRewards: legacy.challengeRewards,
    mailbox: legacy.mailbox,
    migrations: legacy.migrations,
  });
  const progress = await mergePostgresProgress(userId, "legacy-netlify-blobs-v1", legacy.soulCoins, payload);
  return { progress, migrated: true, deducted: legacyResult.deducted };
}

export default async (req: Request) => {
  const auth = await verifySupabaseUser(req);
  if (auth.error) return json({ error: auth.error }, 401);
  if (!postgresReady()) return json({ error: "Player progress Postgres is not configured" }, 503);
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    try {
      const result = await ensureBlobProgressMigrated(store, auth.userId);
      return json({ ...result.progress, migrated_from_blobs: result.migrated, retroPetDeducted: result.deducted });
    } catch (error) {
      console.error("player progress postgres read failed", error && (error as Error).message ? (error as Error).message : error);
      return json({ error: "Unable to load player progress" }, 503);
    }
  }

  if (req.method === "POST" || req.method === "PUT") {
    const contentLength = Number.parseInt(req.headers.get("content-length") || "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid JSON object" }, 400);
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const mutation = body.mutation && typeof body.mutation === "object" ? body.mutation as Record<string, unknown> : {};
    const mutationId = cleanMutationId(mutation.id);
    if (!mutationId) return json({ error: "A progress mutation id is required. Reload the game and retry." }, 409);
    const coinDelta = cleanCoinDelta(mutation.soulCoinDelta);
    try {
      const migration = await ensureBlobProgressMigrated(store, auth.userId);
      const payload = cleanProgressPayload(body);
      const progress = await mergePostgresProgress(auth.userId, mutationId, coinDelta, payload);
      return json({ ...progress, migrated_from_blobs: migration.migrated, retroPetDeducted: migration.deducted });
    } catch (error) {
      console.error("player progress postgres write failed", error && (error as Error).message ? (error as Error).message : error);
      return json({ error: "Unable to save player progress" }, 503);
    }
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/player-progress",
  method: ["GET", "POST", "PUT"],
};

export const playerProgressContract = {
  cleanDone,
  cleanPetState,
  cleanPactState,
  cleanProgressPayload,
  cleanCoinDelta,
  cleanMutationId,
  postgresProgress,
};
