# Supabase Leaderboard Setup

The online leaderboard is stored in `public.leaderboard_runs`. Browser clients do not access the table directly; `/api/leaderboard` validates each run and writes with the server-only Supabase service role.

## 1. Create the table

1. Open the Supabase project dashboard.
2. Open **SQL Editor** and create a new query.
3. Paste and run `supabase/migrations/20260710_leaderboard_runs.sql`.
4. Open **Table Editor** and confirm that `leaderboard_runs` exists.

The migration enables RLS, revokes access from `anon` and `authenticated`, and grants access only to `service_role`.

## 2. Configure Netlify

In **Netlify > Site configuration > Environment variables**, keep the existing values and add:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
```

`SUPABASE_SECRET_KEY` is secret. Set it only in Netlify and local `.env`; never put it in `index.html`, client JavaScript, Git, or screenshots.

The legacy `SUPABASE_SERVICE_ROLE_KEY` is also accepted. Configure only one server key; the newer `SUPABASE_SECRET_KEY` is preferred.

## 3. Deploy and verify

After the next deploy, request:

```text
https://shadow-covenant-3d.netlify.app/api/leaderboard?limit=8
```

The response should include:

```json
{
  "storage": "postgres",
  "postgres_enabled": true
}
```

On the first request, the function imports existing `scores-v5` rows from Netlify Blobs with atomic conflict handling. Blobs remain only for rate limiting and temporary fallback.
