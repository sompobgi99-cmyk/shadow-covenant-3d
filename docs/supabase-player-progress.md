# Supabase Player Progress Setup

Player progress is stored in `public.player_progress`. Soul Coin changes are recorded through the idempotency ledger in `public.player_progress_mutations`. Browser clients never access either table directly; `/api/player-progress` authenticates the user and calls the server-only Postgres RPC.

## 1. Run the migration

1. Open the Supabase project dashboard.
2. Open **SQL Editor** and create a new query.
3. Paste and run `supabase/migrations/20260715_player_progress.sql`.
4. Open **Table Editor** and confirm these tables exist:
   - `player_progress`
   - `player_progress_mutations`
5. In **Database > Functions**, confirm `merge_player_progress` exists.

The migration enables RLS, revokes table and RPC access from `anon` and `authenticated`, and grants access only to `service_role`.

## 2. Configure Netlify

Use the same server variables as the Postgres leaderboard:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SECRET_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` remains supported as a legacy alternative to `SUPABASE_SECRET_KEY`. Never expose either server key in browser JavaScript, Git, screenshots, or Supabase client config.

## 3. Migration behavior

On the first authenticated request for each player:

1. `/api/player-progress` checks Postgres.
2. If no row exists, it reads the player's legacy Netlify Blob.
3. It imports the complete legacy balance and progress using mutation ID `legacy-netlify-blobs-v1`.
4. Every later read and write uses Postgres only.

The legacy Blob remains read-only during the transition. The endpoint no longer writes player progress to Netlify Blobs.

## 4. Concurrency behavior

- Achievement, Pact, Pet ownership, Divine Offering, challenge reward, mailbox, and unlock maps are deep-merged in Postgres.
- Soul Coins use signed deltas rather than replacing the full balance.
- Every delta has a persistent client-generated mutation ID.
- `(user_id, mutation_id)` is unique, so retries cannot grant or charge twice.
- `SELECT ... FOR UPDATE` serializes simultaneous writes for the same player.
- The client keeps unsent mutations in `localStorage`, so a reload or temporary network failure does not discard them.

## 5. Verify after deploy

Log in with Google, earn or spend Soul Coins, and inspect the authenticated response from:

```text
https://shadow-covenant-3d.netlify.app/api/player-progress
```

Expected fields include:

```json
{
  "ok": true,
  "storage": "postgres",
  "revision": 1,
  "soulCoins": 1000
}
```

Then confirm the player's row in `player_progress` and corresponding IDs in `player_progress_mutations`.
