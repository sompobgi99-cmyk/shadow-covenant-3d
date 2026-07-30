import { createHmac, timingSafeEqual } from "node:crypto";

export type RunSessionClaims = {
  v: number;
  runId: string;
  clientId: string;
  difficulty: string;
  mode: string;
  challengeKey: string;
  build: string;
  issuedAt: number;
  expiresAt: number;
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function runSessionSecret() {
  return (
    Netlify.env.get("RANKING_RUN_SECRET")
    || Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || Netlify.env.get("SUPABASE_SECRET_KEY")
    || ""
  ).trim();
}

export function signRunSession(claims: RunSessionClaims, secret: string) {
  if (!secret) throw new Error("Run session secret is not configured");
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyRunSession(token: string, secret: string, now = Date.now()) {
  if (!token || !secret) return { ok: false, reason: "missing" } as const;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return { ok: false, reason: "format" } as const;
  const expected = signature(payload, secret);
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return { ok: false, reason: "signature" } as const;
  }
  let claims: RunSessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "payload" } as const;
  }
  if (!claims || claims.v !== 1 || !claims.runId || !claims.clientId) return { ok: false, reason: "claims" } as const;
  if (!Number.isFinite(claims.issuedAt) || !Number.isFinite(claims.expiresAt)) return { ok: false, reason: "time" } as const;
  if (now < claims.issuedAt - 60_000 || now > claims.expiresAt) return { ok: false, reason: "expired" } as const;
  return { ok: true, claims } as const;
}
