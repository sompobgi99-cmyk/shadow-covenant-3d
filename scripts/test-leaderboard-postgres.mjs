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
  build: "20260710-mailbox",
};

const entry = leaderboardContract.cleanScore(validInput, null);
assert.equal(leaderboardContract.validateScore(entry), "");

const createdAt = "2026-07-10T03:00:00.000Z";
const firstKey = leaderboardContract.scoreDedupeKey(entry, "guest:abc", createdAt);
const retryKey = leaderboardContract.scoreDedupeKey(entry, "guest:abc", createdAt);
const otherPlayerKey = leaderboardContract.scoreDedupeKey(entry, "guest:def", createdAt);
assert.equal(firstKey, retryKey, "same run retry must be idempotent");
assert.notEqual(firstKey, otherPlayerKey, "different clients must not collide");

const databaseRow = leaderboardContract.databaseScore({ ...entry, created_at: createdAt }, firstKey);
const publicRow = leaderboardContract.databaseToPublicScore(databaseRow);
assert.equal(publicRow.score, entry.score);
assert.equal(publicRow.time, entry.time);
assert.equal(publicRow.level, entry.level);
assert.equal(publicRow.stage, entry.stage);
assert.deepEqual(publicRow.pact_ids, []);

const casual = leaderboardContract.cleanScore({ ...validInput, difficulty_id: "casual", difficulty_multiplier: 0.6 }, null);
assert.match(leaderboardContract.validateScore(casual), /Normal and Hard/);

console.log("Leaderboard Postgres contract passed.");
