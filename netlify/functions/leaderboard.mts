import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const STORE_NAME = "shadow-covenant-ranking";
const SCORE_KEY = "scores-v3";
const RATE_KEY = "post-rate-v1";
const MAX_STORED = 100;
const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const RATE_STORE_MAX = 500;
const REQUIRED_BUILD = "20260701-quality-pass-rankreset";

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

function cleanScore(input) {
  return {
    player_name: cleanText(input.player_name || input.name, "Player", 18),
    country_code: cleanCountry(input.country_code || input.country),
    character: cleanText(input.character, "Unknown", 32),
    score: cleanInt(input.score, 0, 999999999),
    kills: cleanInt(input.kills, 0, 999999),
    time: cleanInt(input.time, 0, 999999),
    won: !!input.won,
    level: cleanInt(input.level, 1, 999),
    stage: cleanInt(input.stage, 1, 99),
    damage: cleanInt(input.damage, 0, 9999999),
    items: cleanInt(input.items, 0, 9999),
    build: cleanBuild(input.build),
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

function validateScore(entry) {
  if (entry.build !== REQUIRED_BUILD) return "Outdated game version. Please reload before ranking.";
  if (!entry.player_name) return "Missing player name";
  if (entry.score < 0 || entry.kills < 0 || entry.time < 0) return "Negative values are not allowed";
  if (entry.score > 0 && entry.time < 8) return "Run is too short for a scored entry";
  if (entry.score > looseScoreCap(entry)) return "Score is outside the accepted range";
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
    const rows = (await readScores(store))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")))
      .slice(0, limit);
    return json({ rows, required_build: REQUIRED_BUILD });
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
    const entry = cleanScore(body);
    const problem = validateScore(entry);
    if (problem) return json({ error: problem, required_build: REQUIRED_BUILD }, problem.startsWith("Outdated") ? 426 : 400);
    const rows = await readScores(store);
    if (isDuplicateScore(rows, entry)) return json({ ok: true, duplicate: true });
    rows.push(entry);
    rows.sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
    await store.setJSON(SCORE_KEY, rows.slice(0, MAX_STORED));
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/leaderboard",
  method: ["GET", "POST"],
};
