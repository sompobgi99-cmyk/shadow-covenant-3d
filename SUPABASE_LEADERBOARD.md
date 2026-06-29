# Supabase leaderboard setup

The game works without Supabase. If `ONLINE_LEADERBOARD.supabaseUrl` and
`ONLINE_LEADERBOARD.supabaseAnonKey` are empty, scores stay in localStorage.

## 1. Create the table

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  character text not null,
  score integer not null,
  kills integer not null default 0,
  time integer not null default 0,
  won boolean not null default false,
  level integer not null default 1,
  stage integer not null default 1,
  damage integer not null default 0,
  items integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

create policy "public leaderboard read"
on public.leaderboard
for select
using (true);

create policy "public leaderboard insert"
on public.leaderboard
for insert
with check (
  char_length(player_name) between 1 and 18
  and score >= 0
  and kills >= 0
  and time >= 0
);
```

## 2. Add project config

Edit `js/online-leaderboard.js`:

```js
const ONLINE_LEADERBOARD = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_PUBLIC_KEY',
  table: 'leaderboard',
  limit: 8,
};
```

Only use the anon public key here. Do not put service-role keys in frontend code.
