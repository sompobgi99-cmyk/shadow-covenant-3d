import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE_NAME = "shadow-covenant-ranking";
const SCORE_KEY = "scores-v5";
const RATE_KEY = "post-rate-v1";
const POSTGRES_MIGRATION_KEY = "postgres-migration-v1";
const POSTGRES_TABLE = "leaderboard_runs";
const MAX_STORED = 100;
const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const RATE_STORE_MAX = 500;
const REQUIRED_BUILD = "20260712-soul-rewards";
const RANKED_DIFFICULTY_MULTIPLIERS = {
  normal: 1,
  hard: 1.4,
};
const MAX_RANKED_STAGE = 3;
const MAX_RANKED_LEVEL = 60;
const MAX_RANKED_PACTS = 5;

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function cleanText(value, fallback, maxLen) {
  return String(value || fallback)
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function cleanInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function cleanCountry(value) {
  const code = String(value || "TH").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "TH";
}

function cleanBuild(value) {
  return String(value || "").replace(/[^\w.-]/g, "").slice(0, 64);
}

function cleanId(value) {
  return String(value || "").replace(/[^\w.-]/g, "").slice(0, 80);
}

function supabaseEnv() {
  return {
    url: (Netlify.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, ""),
    anonKey: (Netlify.env.get("SUPABASE_ANON_KEY") || "").trim(),
    serviceKey: (Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") || Netlify.env.get("SUPABASE_SECRET_KEY") || "").trim(),
  };
}

function postgresReady() {
  const { url, serviceKey } = supabaseEnv();
  return !!(url && serviceKey);
}

function bearerToken(req) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function userDisplayName(data) {
  const meta = data && data.user_metadata ? data.user_metadata : {};
  return cleanText(meta.full_name || meta.name || meta.preferred_username || "", "", 48);
}

async function verifySupabaseUser(req) {
  const token = bearerToken(req);
  if (!token) return { user: null, error: "" };
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return { user: null, error: "Auth is not configured on the server" };
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return { user: null, error: "Login session is invalid or expired" };
    const data = await res.json();
    const id = cleanId(data && data.id);
    if (!id) return { user: null, error: "Login session is missing a user id" };
    return {
      user: {
        id,
        name: userDisplayName(data),
      },
      error: "",
    };
  } catch {
    return { user: null, error: "Unable to verify login session" };
  }
}

function cleanScore(input, authUser) {
  const pactIds = Array.isArray(input.pact_ids || input.pactIds)
    ? (input.pact_ids || input.pactIds).map((v: unknown) => cleanText(v, "", 32)).filter(Boolean).slice(0, 12)
    : [];
  return {
    player_name: cleanText(input.player_name || input.name, "Player", 18),
    country_code: cleanCountry(input.country_code || input.country),
    character: cleanText(input.character, "Unknown", 32),
    score: cleanInt(input.score, 0, 999999999),
    score_before_penalty: cleanInt(input.score_before_penalty || input.scoreBeforePenalty || input.score, 0, 999999999),
    death_penalty_percent: cleanInt(input.death_penalty_percent || input.deathPenaltyPercent, 0, 100),
    death_penalty_amount: cleanInt(input.death_penalty_amount || input.deathPenaltyAmount, 0, 999999999),
    death_penalty_reason: cleanText(input.death_penalty_reason || input.deathPenaltyReason, "", 64),
    kills: cleanInt(input.kills, 0, 999999),
    time: cleanInt(input.time, 0, 999999),
    won: !!input.won,
    level: cleanInt(input.level, 1, 999),
    stage: cleanInt(input.stage, 1, 99),
    damage: cleanInt(input.damage, 0, 9999999),
    items: cleanInt(input.items, 0, 9999),
    difficulty_id: cleanText(input.difficulty_id || input.difficultyId, "normal", 24),
    difficulty_name: cleanText(input.difficulty_name || input.difficultyName, "Normal", 32),
    difficulty_multiplier: Math.max(0.1, Math.min(3, Number(input.difficulty_multiplier || input.difficultyMultiplier || 1) || 1)),
    pact_ids: pactIds,
    pact_multiplier: Math.max(1, Math.min(2.5, Number(input.pact_multiplier || input.pactMultiplier || 1) || 1)),
    pact_label: cleanText(input.pact_label || input.pactLabel, "", 160),
    pact_count: cleanInt(input.pact_count || input.pactCount || pactIds.length, 0, 12),
    build: cleanBuild(input.build),
    user_id: authUser ? authUser.id : "",
    auth_name: authUser ? authUser.name : "",
    verified: !!authUser,
    created_at: new Date().toISOString(),
  };
}

function clientFingerprint(req) {
  const forwarded = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const agent = req.headers.get("user-agent") || "";
  return createHash("sha256").update(`${ip}|${agent}`).digest("hex").slice(0, 24);
}

function looseScoreCap(entry) {
  const time = Math.max(1, entry.time || 0);
  const stage = Math.max(1, entry.stage || 1);
  const base = 500000;
  return base
    + time * 120000
    + (entry.kills || 0) * 45000
    + (entry.level || 1) * 250000
    + stage * 2000000
    + (entry.items || 0) * 1200000
    + (entry.won ? 4000000 : 0);
}

function near(value, expected, tolerance = 0.025) {
  return Math.abs(Number(value || 0) - expected) <= tolerance;
}

function rankedDifficultyMultiplier(id) {
  return RANKED_DIFFICULTY_MULTIPLIERS[id] || 0;
}

function plausibleKillsCap(entry) {
  const minutes = Math.max(1, Math.ceil((entry.time || 0) / 60));
  const hardBonus = entry.difficulty_id === "hard" ? 120 : 0;
  const overtimeBonus = Math.max(0, minutes - 10) * 180;
  return 350 + minutes * (520 + hardBonus) + overtimeBonus;
}

function validateMultipliers(entry) {
  const expectedDifficulty = rankedDifficultyMultiplier(entry.difficulty_id);
  if (!expectedDifficulty) return "Only Normal and Hard runs can submit to ranking";
  if (!near(entry.difficulty_multiplier, expectedDifficulty)) return "Difficulty multiplier does not match the selected mode";
  if (entry.pact_count !== entry.pact_ids.length) return "Pact count does not match the selected pact list";
  if (entry.pact_count > MAX_RANKED_PACTS) return "Too many pacts were submitted";
  if (entry.pact_ids.length && entry.difficulty_id !== "normal" && entry.difficulty_id !== "hard") return "Pacts are only ranked on Normal and Hard";
  if (entry.pact_ids.length && entry.pact_multiplier <= 1) return "Pact multiplier is missing";
  if (entry.pact_multiplier > 2.5) return "Pact multiplier is outside the accepted range";
  return "";
}

function validateScore(entry) {
  if (entry.build !== REQUIRED_BUILD) return "Outdated game version. Please reload before ranking.";
  if (!entry.player_name) return "Missing player name";
  if (entry.score < 0 || entry.kills < 0 || entry.time < 0) return "Negative values are not allowed";
  if (entry.score > 0 && entry.time < 8) return "Run is too short for a scored entry";
  if (entry.stage < 1 || entry.stage > MAX_RANKED_STAGE) return "Stage is outside the accepted range";
  if (entry.level < 1 || entry.level > MAX_RANKED_LEVEL) return "Level is outside the accepted range";
  if (entry.items < 0 || entry.items > 120) return "Item count is outside the accepted range";
  if (entry.time > 3600) return "Run time is outside the accepted range";
  if (entry.won && entry.stage !== MAX_RANKED_STAGE) return "Winning runs must finish on Map 3";
  if (entry.kills > plausibleKillsCap(entry)) return "Kill count is outside the accepted range";
  const multiplierProblem = validateMultipliers(entry);
  if (multiplierProblem) return multiplierProblem;
  const scoreToCheck = Math.max(entry.score || 0, entry.score_before_penalty || 0);
  if (scoreToCheck > looseScoreCap(entry)) return "Score is outside the accepted range";
  return "";
}

function isDuplicateScore(rows, entry) {
  const now = Date.now();
  return rows.some((row) => {
    const created = Date.parse(row.created_at || "") || 0;
    return now - created < 5 * 60 * 1000
      && row.player_name === entry.player_name
      && row.country_code === entry.country_code
      && row.character === entry.character
      && row.build === entry.build
      && row.score === entry.score
      && row.kills === entry.kills
      && row.time === entry.time;
  });
}

async function readScores(store) {
  const rows = await store.get(SCORE_KEY, { type: "json" });
  return Array.isArray(rows) ? rows : [];
}

function publicScore(row) {
  return {
    player_name: row.player_name || "Player",
    country_code: row.country_code || "TH",
    character: row.character || "Unknown",
    score: row.score || 0,
    score_before_penalty: row.score_before_penalty || row.score || 0,
    death_penalty_percent: row.death_penalty_percent || 0,
    death_penalty_amount: row.death_penalty_amount || 0,
    death_penalty_reason: row.death_penalty_reason || "",
    kills: row.kills || 0,
    time: row.time || 0,
    won: !!row.won,
    level: row.level || 1,
    stage: row.stage || 1,
    damage: row.damage || 0,
    items: row.items || 0,
    difficulty_id: row.difficulty_id || "normal",
    difficulty_name: row.difficulty_name || "Normal",
    difficulty_multiplier: row.difficulty_multiplier || 1,
    pact_ids: row.pact_ids || [],
    pact_multiplier: row.pact_multiplier || 1,
    pact_label: row.pact_label || "",
    pact_count: row.pact_count || ((row.pact_ids || []).length),
    build: row.build || "",
    created_at: row.created_at || "",
    verified: !!row.verified,
  };
}

function scoreDedupeKey(entry, identity, createdAt = "") {
  const parsed = Date.parse(createdAt || entry.created_at || "");
  const bucket = Math.floor((Number.isFinite(parsed) ? parsed : Date.now()) / (5 * 60 * 1000));
  const stable = [
    identity,
    bucket,
    entry.player_name,
    entry.country_code,
    entry.character,
    entry.score,
    entry.kills,
    entry.time,
    entry.level,
    entry.stage,
    entry.build,
  ];
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function databaseScore(entry, dedupeKey, source = "game") {
  return {
    dedupe_key: dedupeKey,
    player_name: entry.player_name,
    country_code: entry.country_code,
    character: entry.character,
    score: entry.score,
    score_before_penalty: entry.score_before_penalty,
    death_penalty_percent: entry.death_penalty_percent,
    death_penalty_amount: entry.death_penalty_amount,
    death_penalty_reason: entry.death_penalty_reason,
    kills: entry.kills,
    time_seconds: entry.time,
    won: entry.won,
    player_level: entry.level,
    map_stage: entry.stage,
    damage_taken: entry.damage,
    item_count: entry.items,
    difficulty_id: entry.difficulty_id,
    difficulty_name: entry.difficulty_name,
    difficulty_multiplier: entry.difficulty_multiplier,
    pact_ids: entry.pact_ids,
    pact_multiplier: entry.pact_multiplier,
    pact_label: entry.pact_label,
    pact_count: entry.pact_count,
    build: entry.build,
    user_id: entry.user_id || null,
    auth_name: entry.auth_name || "",
    verified: !!entry.verified,
    source,
    created_at: entry.created_at || new Date().toISOString(),
  };
}

function databaseToPublicScore(row) {
  return publicScore({
    ...row,
    time: row.time_seconds,
    level: row.player_level,
    stage: row.map_stage,
    damage: row.damage_taken,
    items: row.item_count,
  });
}

async function postgresRequest(path, init = {}) {
  const { url, serviceKey } = supabaseEnv();
  if (!url || !serviceKey) throw new Error("Supabase Postgres is not configured");
  const headers = {
    apikey: serviceKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
}

async function postgresError(res, action) {
  let detail = "";
  try { detail = cleanText(await res.text(), "", 240); } catch {}
  return new Error(`Supabase ${action} failed (${res.status})${detail ? `: ${detail}` : ""}`);
}

async function readPostgresScores(limit) {
  const params = new URLSearchParams({
    select: "player_name,country_code,character,score,score_before_penalty,death_penalty_percent,death_penalty_amount,death_penalty_reason,kills,time_seconds,won,player_level,map_stage,damage_taken,item_count,difficulty_id,difficulty_name,difficulty_multiplier,pact_ids,pact_multiplier,pact_label,pact_count,build,created_at,verified",
    build: `eq.${REQUIRED_BUILD}`,
    order: "score.desc,created_at.asc",
    limit: String(limit),
  });
  const res = await postgresRequest(`${POSTGRES_TABLE}?${params.toString()}`, { method: "GET" });
  if (!res.ok) throw await postgresError(res, "leaderboard read");
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map(databaseToPublicScore);
}

async function insertPostgresRows(rows) {
  if (!rows.length) return [];
  const params = new URLSearchParams({ on_conflict: "dedupe_key" });
  const res = await postgresRequest(`${POSTGRES_TABLE}?${params.toString()}`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw await postgresError(res, "leaderboard insert");
  const inserted = await res.json();
  return Array.isArray(inserted) ? inserted : [];
}

async function ensureBlobScoresMigrated(store) {
  const marker = await store.get(POSTGRES_MIGRATION_KEY, { type: "json" });
  if (marker && marker.complete) return marker;
  const rows = await readScores(store);
  const payload = rows.map((row) => {
    const entry = cleanScore(row, row.user_id ? { id: row.user_id, name: row.auth_name || "" } : null);
    entry.created_at = row.created_at || entry.created_at;
    const identity = row.user_id ? `user:${row.user_id}` : `legacy:${row.player_name || "Player"}:${row.country_code || "TH"}`;
    return databaseScore(entry, scoreDedupeKey(entry, identity, entry.created_at), "netlify-blobs-migration");
  });
  const inserted = await insertPostgresRows(payload);
  const result = { complete: true, scanned: rows.length, inserted: inserted.length, migrated_at: new Date().toISOString() };
  await store.setJSON(POSTGRES_MIGRATION_KEY, result);
  return result;
}

async function markBlobMigrationPending(store) {
  await store.setJSON(POSTGRES_MIGRATION_KEY, { complete: false, pending_at: new Date().toISOString() });
}

async function checkRateLimit(store, req) {
  const fingerprint = clientFingerprint(req);
  const now = Date.now();
  const data = (await store.get(RATE_KEY, { type: "json" })) || {};
  const entries = Object.entries(data)
    .map(([key, times]) => [key, Array.isArray(times) ? times.filter((t) => now - Number(t) < RATE_WINDOW_MS) : []])
    .filter(([, times]) => times.length);
  const limited = {};
  for (const [key, times] of entries.slice(-RATE_STORE_MAX)) limited[String(key)] = times;
  const mine = limited[fingerprint] || [];
  if (mine.length >= RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - mine[0])) / 1000));
    return { ok: false, retryAfter };
  }
  mine.push(now);
  limited[fingerprint] = mine;
  await store.setJSON(RATE_KEY, limited);
  return { ok: true, retryAfter: 0 };
}

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const limit = cleanInt(url.searchParams.get("limit"), 8, 50);
    if (postgresReady()) {
      try {
        const migration = await ensureBlobScoresMigrated(store);
        const rows = await readPostgresScores(limit);
        const env = supabaseEnv();
        return json({ rows, required_build: REQUIRED_BUILD, auth_enabled: !!(env.url && env.anonKey), postgres_enabled: true, storage: "postgres", migration });
      } catch (error) {
        console.warn("leaderboard postgres read fallback", error && error.message ? error.message : error);
      }
    }
    const rows = (await readScores(store))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")))
      .slice(0, limit)
      .map(publicScore);
    const env = supabaseEnv();
    return json({ rows, required_build: REQUIRED_BUILD, auth_enabled: !!(env.url && env.anonKey), postgres_enabled: postgresReady(), storage: "netlify-blobs-fallback" });
  }

  if (req.method === "POST") {
    const contentLength = cleanInt(req.headers.get("content-length"), 0, MAX_BODY_BYTES + 1);
    if (contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
    const rate = await checkRateLimit(store, req);
    if (!rate.ok) {
      return new Response(JSON.stringify({ error: "Too many score submissions", retry_after: rate.retryAfter }), {
        status: 429,
        headers: { ...jsonHeaders, "Retry-After": String(rate.retryAfter) },
      });
    }
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const auth = await verifySupabaseUser(req);
    if (auth.error) return json({ error: auth.error }, 401);
    const entry = cleanScore(body, auth.user);
    const problem = validateScore(entry);
    if (problem) return json({ error: problem, required_build: REQUIRED_BUILD }, problem.startsWith("Outdated") ? 426 : 400);
    if (postgresReady()) {
      try {
        await ensureBlobScoresMigrated(store);
        const identity = auth.user ? `user:${auth.user.id}` : `guest:${clientFingerprint(req)}`;
        const payload = databaseScore(entry, scoreDedupeKey(entry, identity));
        const inserted = await insertPostgresRows([payload]);
        return json({ ok: true, duplicate: inserted.length === 0, verified: entry.verified, storage: "postgres" });
      } catch (error) {
        console.warn("leaderboard postgres write fallback", error && error.message ? error.message : error);
        try { await markBlobMigrationPending(store); } catch (markerError) {
          console.warn("leaderboard migration marker fallback", markerError && markerError.message ? markerError.message : markerError);
        }
      }
    }
    const rows = await readScores(store);
    if (isDuplicateScore(rows, entry)) return json({ ok: true, duplicate: true, verified: entry.verified, storage: "netlify-blobs-fallback" });
    rows.push(entry);
    rows.sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
    await store.setJSON(SCORE_KEY, rows.slice(0, MAX_STORED));
    return json({ ok: true, verified: entry.verified, storage: "netlify-blobs-fallback" });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/leaderboard",
  method: ["GET", "POST"],
};

export const leaderboardContract = {
  cleanScore,
  validateScore,
  scoreDedupeKey,
  databaseScore,
  databaseToPublicScore,
};
