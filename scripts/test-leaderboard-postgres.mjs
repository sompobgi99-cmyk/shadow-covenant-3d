import assert from "node:assert/strict";
import { leaderboardContract } from "../netlify/functions/leaderboard.mts";

const validInput = {
  player_name: "Tester",
  country_code: "TH",
  character: "Paladin",
  score: 250000,
  score_before_penalty: 250000,
  kills: 120,
  time: 600,
  won: false,
  level: 20,
  stage: 2,
  damage: 50,
  items: 5,
  difficulty_id: "normal",
  difficulty_name: "Normal",
  difficulty_multiplier: 1,
  pact_ids: [],
  pact_multiplier: 1,
  pact_count: 0,
  run_id: "run_test_stable_001",
  client_id: "client_test_install_001",
  build: leaderboardContract.requiredBuild,
};

const entry = leaderboardContract.cleanScore(validInput, null);
assert.equal(leaderboardContract.validateScore(entry), "");
const outdated = leaderboardContract.cleanScore({ ...validInput, build: "old-build" }, null);
assert.equal(leaderboardContract.validateScore(outdated), "");
const migratedBuildRow = leaderboardContract.databaseScore(outdated, leaderboardContract.scoreDedupeKey(outdated, "guest:old-build"));
assert.equal(migratedBuildRow.build, leaderboardContract.requiredBuild, "legacy builds must be stored in the current ranking partition");
const missingBuild = leaderboardContract.cleanScore({ ...validInput, build: "" }, null);
assert.match(leaderboardContract.validateScore(missingBuild), /Missing game build/);
const longRun = leaderboardContract.cleanScore({ ...validInput, time: 7200, kills: 50000 }, null);
assert.equal(leaderboardContract.validateScore(longRun), "", "long overtime runs should remain rankable");

const createdAt = "2026-07-10T03:00:00.000Z";
const firstKey = leaderboardContract.scoreDedupeKey(entry, "guest:abc", createdAt);
const retryKey = leaderboardContract.scoreDedupeKey(entry, "guest:abc", createdAt);
const delayedRetryKey = leaderboardContract.scoreDedupeKey(entry, "guest:abc", "2026-07-10T04:30:00.000Z");
const otherPlayerKey = leaderboardContract.scoreDedupeKey(entry, "guest:def", createdAt);
assert.equal(firstKey, retryKey, "same run retry must be idempotent");
assert.equal(firstKey, delayedRetryKey, "same run retry must stay idempotent outside the old five-minute window");
assert.notEqual(firstKey, otherPlayerKey, "different clients must not collide");

const databaseRow = leaderboardContract.databaseScore({ ...entry, created_at: createdAt }, firstKey);
const publicRow = leaderboardContract.databaseToPublicScore(databaseRow);
assert.equal(publicRow.score, entry.score);
assert.equal(publicRow.time, entry.time);
assert.equal(publicRow.level, entry.level);
assert.equal(publicRow.stage, entry.stage);
assert.deepEqual(publicRow.pact_ids, []);

const daily = leaderboardContract.cleanScore({ ...validInput, run_mode:"daily", challenge_key:"2026-07-14" }, null);
assert.equal(leaderboardContract.validateScore(daily), "");
const dailyDatabase = leaderboardContract.databaseScore({ ...daily, created_at:createdAt }, leaderboardContract.scoreDedupeKey(daily,"guest:daily",createdAt));
assert.equal(dailyDatabase.source, "daily:2026-07-14");
assert.equal(leaderboardContract.scoreSource(daily), "daily:2026-07-14");
const dailyPublic = leaderboardContract.databaseToPublicScore(dailyDatabase);
assert.equal(dailyPublic.run_mode, "daily");
assert.equal(dailyPublic.challenge_key, "2026-07-14");

const weekly = leaderboardContract.cleanScore({
  ...validInput,
  run_mode:"weekly",
  challenge_key:"2026-W29",
  stage:4,
  won:true,
}, null);
assert.equal(leaderboardContract.validateScore(weekly), "", "Weekly Arena stage 4 must be rankable");
const wrongWeeklyStage = leaderboardContract.cleanScore({ ...weekly, stage:3 }, null);
assert.match(leaderboardContract.validateScore(wrongWeeklyStage), /Weekly Arena stage/);

const migratedStandard = leaderboardContract.cleanScore({ ...validInput, run_id:"run_migrated_standard", run_mode:"standard" }, null);
const migratedDatabase = leaderboardContract.databaseScore(migratedStandard, leaderboardContract.scoreDedupeKey(migratedStandard,"legacy:tester"));
assert.equal(migratedDatabase.source, "game", "migrated fallback scores must remain visible on Standard ranking");
const blobRows = [{ ...validInput, created_at:createdAt }];
assert.equal(leaderboardContract.blobScoreDigest(blobRows), leaderboardContract.blobScoreDigest(blobRows));
assert.notEqual(leaderboardContract.blobScoreDigest(blobRows), leaderboardContract.blobScoreDigest([{ ...blobRows[0], score:validInput.score+1 }]));

const invalidChallenge = leaderboardContract.cleanScore({ ...validInput, run_mode:"weekly", challenge_key:"", stage:4 }, null);
assert.match(leaderboardContract.validateScore(invalidChallenge), /period key/);

const casual = leaderboardContract.cleanScore({ ...validInput, difficulty_id: "casual", difficulty_multiplier: 0.6 }, null);
assert.match(leaderboardContract.validateScore(casual), /Normal and Hard/);

const sharedNetworkRequest = new Request("https://example.test/api/leaderboard", {
  headers: {
    "x-nf-client-connection-ip": "203.0.113.10",
    "user-agent": "Leaderboard Test",
  },
});
const guestFingerprint = leaderboardContract.clientFingerprint(sharedNetworkRequest);
assert.equal(guestFingerprint, leaderboardContract.clientFingerprint(sharedNetworkRequest), "guest fingerprint must be stable");
assert.notEqual(
  leaderboardContract.clientFingerprint(sharedNetworkRequest, "user-a"),
  leaderboardContract.clientFingerprint(sharedNetworkRequest, "user-b"),
  "signed-in users on the same network must have separate rate limits",
);
assert.notEqual(
  leaderboardContract.clientFingerprint(sharedNetworkRequest, "", "client-a"),
  leaderboardContract.clientFingerprint(sharedNetworkRequest, "", "client-b"),
  "guest installs must have separate rate limits on the same network",
);

console.log("Leaderboard Postgres contract passed.");
