import { createHash } from "node:crypto";

const MAX_BODY_BYTES = 8192;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const KNOWN_KINDS = new Set([
  "javascript_error",
  "unhandled_rejection",
  "asset_load",
  "ranking_error",
  "progress_sync_error",
  "game_flow_error",
]);
const rateByClient = new Map<string, { start: number; count: number }>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value: unknown, max: number) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/[?&](access_token|refresh_token|token)=[^&\s]+/gi, "?$1=[redacted]")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    const cleanKey = cleanText(key, 32).replace(/[^\w.-]/g, "");
    if (!cleanKey || /token|email|name|user|auth/i.test(cleanKey)) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) out[cleanKey] = raw;
    else if (typeof raw === "boolean") out[cleanKey] = raw;
    else out[cleanKey] = cleanText(raw, 180);
  }
  return out;
}

function fingerprint(req: Request) {
  const forwarded = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function rateAllowed(key: string, now = Date.now()) {
  const current = rateByClient.get(key);
  if (!current || now - current.start >= RATE_WINDOW_MS) {
    rateByClient.set(key, { start: now, count: 1 });
    return true;
  }
  current.count++;
  return current.count <= RATE_LIMIT;
}

export function cleanClientEvent(input: Record<string, unknown>) {
  const rawKind = cleanText(input.kind, 32);
  const kind = KNOWN_KINDS.has(rawKind) ? rawKind : "game_flow_error";
  const viewport = Array.isArray(input.viewport)
    ? input.viewport.slice(0, 2).map(value => Math.max(0, Math.min(10000, Number(value) || 0)))
    : [];
  return {
    kind,
    message: cleanText(input.message, 500),
    context: cleanContext(input.context),
    build: cleanText(input.build, 80),
    path: cleanText(input.path, 120),
    viewport,
    touch: !!input.touch,
    language: cleanText(input.language, 16),
  };
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  const client = fingerprint(req);
  if (!rateAllowed(client)) return json({ error: "Too many events" }, 429);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const event = cleanClientEvent(body);
  if (!event.message) return json({ error: "Event message is required" }, 400);
  console.log("shadow-covenant-client-event", JSON.stringify({
    ...event,
    client,
    received_at: new Date().toISOString(),
  }));
  return json({ ok: true }, 202);
};

export const config = {
  path: "/api/client-events",
  method: ["POST"],
};

export const clientEventContract = { cleanClientEvent, rateAllowed };
