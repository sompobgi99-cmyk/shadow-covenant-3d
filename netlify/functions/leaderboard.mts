import { getStore } from "@netlify/blobs";

const STORE_NAME = "shadow-covenant-ranking";
const SCORE_KEY = "scores-v2";
const MAX_STORED = 100;

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
    created_at: new Date().toISOString(),
  };
}

async function readScores(store) {
  const rows = await store.get(SCORE_KEY, { type: "json" });
  return Array.isArray(rows) ? rows : [];
}

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const limit = cleanInt(url.searchParams.get("limit"), 8, 50);
    const rows = (await readScores(store))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")))
      .slice(0, limit);
    return json({ rows });
  }

  if (req.method === "POST") {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const entry = cleanScore(body);
    if (!entry.player_name || entry.score < 0) return json({ error: "Invalid score" }, 400);
    const rows = await readScores(store);
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
