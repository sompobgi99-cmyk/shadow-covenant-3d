create table if not exists public.leaderboard_runs (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  player_name text not null,
  country_code text not null default 'TH',
  character text not null,
  score bigint not null default 0,
  score_before_penalty bigint not null default 0,
  death_penalty_percent integer not null default 0,
  death_penalty_amount bigint not null default 0,
  death_penalty_reason text not null default '',
  kills integer not null default 0,
  time_seconds integer not null default 0,
  won boolean not null default false,
  player_level integer not null default 1,
  map_stage integer not null default 1,
  damage_taken integer not null default 0,
  item_count integer not null default 0,
  difficulty_id text not null default 'normal',
  difficulty_name text not null default 'Normal',
  difficulty_multiplier numeric(6,3) not null default 1,
  pact_ids jsonb not null default '[]'::jsonb,
  pact_multiplier numeric(6,3) not null default 1,
  pact_label text not null default '',
  pact_count integer not null default 0,
  build text not null,
  user_id uuid references auth.users(id) on delete set null,
  auth_name text not null default '',
  verified boolean not null default false,
  source text not null default 'game',
  created_at timestamptz not null default now(),
  constraint leaderboard_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint leaderboard_score_nonnegative check (score >= 0 and score_before_penalty >= 0),
  constraint leaderboard_run_values check (kills >= 0 and time_seconds >= 0 and player_level >= 1 and map_stage >= 1),
  constraint leaderboard_pacts_array check (jsonb_typeof(pact_ids) = 'array')
);

create index if not exists leaderboard_runs_build_score_idx
  on public.leaderboard_runs (build, score desc, created_at asc);

create index if not exists leaderboard_runs_user_created_idx
  on public.leaderboard_runs (user_id, created_at desc)
  where user_id is not null;

alter table public.leaderboard_runs enable row level security;

revoke all on table public.leaderboard_runs from anon, authenticated;
grant select, insert on table public.leaderboard_runs to service_role;
grant usage, select on sequence public.leaderboard_runs_id_seq to service_role;

comment on table public.leaderboard_runs is
  'Validated Shadow Covenant runs. Browser clients use the Netlify leaderboard function; only service_role accesses this table.';
