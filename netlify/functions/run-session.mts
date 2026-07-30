import { runSessionSecret, signRunSession } from "../lib/run-session.mts";

const MAX_BODY_BYTES = 2048;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, max: number) {
  return String(value || "").replace(/[^\w.-]/g, "").slice(0, max);
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  const secret = runSessionSecret();
  if (!secret) return json({ error: "Run sessions are not configured" }, 503);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const runId = clean(body.run_id, 80);
  const clientId = clean(body.client_id, 80);
  const difficulty = clean(body.difficulty_id, 24);
  const mode = clean(body.run_mode, 16) || "standard";
  const challengeKey = clean(body.challenge_key, 24);
  const build = clean(body.build, 80);
  if (!runId || !clientId || !["casual", "normal", "hard"].includes(difficulty)) {
    return json({ error: "Invalid run session request" }, 400);
  }
  if (!["standard", "weekly"].includes(mode)) return json({ error: "Invalid run mode" }, 400);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const token = signRunSession({
    v: 1,
    runId,
    clientId,
    difficulty,
    mode,
    challengeKey,
    build,
    issuedAt,
    expiresAt,
  }, secret);
  return json({ ok: true, token, issued_at: issuedAt, expires_at: expiresAt });
};

export const config = {
  path: "/api/run-session",
  method: ["POST"],
};
