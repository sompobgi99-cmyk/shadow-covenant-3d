import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { playerProgressContract } from "../netlify/functions/player-progress.mts";

const migration = await readFile("supabase/migrations/20260715_player_progress.sql", "utf8");

for (const required of [
  "create table if not exists public.player_progress",
  "create table if not exists public.player_progress_mutations",
  "primary key (user_id, mutation_id)",
  "for update",
  "on conflict (user_id, mutation_id) do nothing",
  "enable row level security",
  "revoke all on table public.player_progress from anon, authenticated",
  "revoke all on function public.merge_player_progress",
]) assert.ok(migration.toLowerCase().includes(required.toLowerCase()), `migration missing: ${required}`);

assert.equal(playerProgressContract.cleanMutationId("abc-123.bad"), "abc-123.bad");
assert.equal(playerProgressContract.cleanMutationId("../../bad id"), "....badid");
assert.equal(playerProgressContract.cleanCoinDelta(10000000), 9999999);
assert.equal(playerProgressContract.cleanCoinDelta(-10000000), -9999999);

const clean = playerProgressContract.cleanProgressPayload({
  done: { first_hunt: "2026-07-15T00:00:00.000Z", injected: "yes" },
  soulCoins: 9999999,
  pets: { owned: { lumo_wisp: "2026-07-15T00:00:00.000Z", fake_pet: "now" }, selected: "lumo_wisp" },
  mailbox: {
    claimed: { "gift-1": "2026-07-15T00:00:00.000Z" },
    deleted: { "news-1": "2026-07-15T01:00:00.000Z" },
  },
});
assert.deepEqual(Object.keys(clean.done), ["first_hunt"]);
assert.deepEqual(Object.keys(clean.pets.owned), ["lumo_wisp"]);
assert.equal(clean.pets.selected, "lumo_wisp");
assert.deepEqual(Object.keys(clean.mailbox.deleted), ["news-1"]);
assert.equal(Object.hasOwn(clean, "soulCoins"), false, "snapshot balance must never enter the Postgres merge payload");

const row = playerProgressContract.postgresProgress({
  soul_coins: 123,
  done: clean.done,
  pets: clean.pets,
  revision: 7,
  updated_at: "2026-07-15T00:00:00.000Z",
});
assert.equal(row.storage, "postgres");
assert.equal(row.soulCoins, 123);
assert.equal(row.revision, 7);

console.log("Player progress Postgres contract passed");
