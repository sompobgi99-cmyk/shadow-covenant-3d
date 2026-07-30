import assert from "node:assert/strict";
import { clientEventContract } from "../netlify/functions/client-events.mts";
import { progressBackupContract } from "../netlify/functions/progress-backup.mts";
import { signRunSession, verifyRunSession } from "../netlify/lib/run-session.mts";

const cleaned = clientEventContract.cleanClientEvent({
  kind: "javascript_error",
  message: "Failed Bearer secret-token?access_token=private",
  context: {
    status: 503,
    retry: true,
    email: "must-not-survive@example.com",
    token: "must-not-survive",
  },
  build: "20260730-system-hardening",
  path: "/game",
  viewport: [844, 390],
  touch: true,
  language: "th-TH",
});
assert.equal(cleaned.kind, "javascript_error");
assert.equal(cleaned.context.status, 503);
assert.equal(cleaned.context.retry, true);
assert.equal("email" in cleaned.context, false);
assert.equal("token" in cleaned.context, false);
assert.equal(cleaned.message.includes("secret-token"), false);
assert.equal(cleaned.message.includes("private"), false);
assert.deepEqual(cleaned.viewport, [844, 390]);

assert.equal(progressBackupContract.backupSlot(new Date("2026-07-26T00:00:00Z")), "daily-0");
assert.equal(progressBackupContract.backupSlot(new Date("2026-07-30T00:00:00Z")), "daily-4");

const issuedAt = Date.now() - 60_000;
const runToken = signRunSession({
  v: 1,
  runId: "run-contract",
  clientId: "client-contract",
  difficulty: "normal",
  mode: "standard",
  challengeKey: "",
  build: "contract",
  issuedAt,
  expiresAt: issuedAt + 600_000,
}, "contract-secret");
const verifiedRun = verifyRunSession(runToken, "contract-secret");
assert.equal(verifiedRun.ok, true);
assert.equal(verifiedRun.ok && verifiedRun.claims.runId, "run-contract");
assert.equal(verifyRunSession(`${runToken}x`, "contract-secret").ok, false);

console.log("Hardening contracts passed.");
