create table if not exists public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  soul_coins bigint not null default 0 check (soul_coins >= 0 and soul_coins <= 9999999),
  done jsonb not null default '{}'::jsonb check (jsonb_typeof(done) = 'object'),
  pacts jsonb not null default '{"done":{"normal":{},"hard":{}}}'::jsonb check (jsonb_typeof(pacts) = 'object'),
  pets jsonb not null default '{"owned":{},"selected":""}'::jsonb check (jsonb_typeof(pets) = 'object'),
  divine_offerings jsonb not null default '{"owned":{}}'::jsonb check (jsonb_typeof(divine_offerings) = 'object'),
  challenge_rewards jsonb not null default '{}'::jsonb check (jsonb_typeof(challenge_rewards) = 'object'),
  mailbox jsonb not null default '{"read":{},"claimed":{},"deleted":{}}'::jsonb check (jsonb_typeof(mailbox) = 'object'),
  migrations jsonb not null default '{}'::jsonb check (jsonb_typeof(migrations) = 'object'),
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_progress_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null,
  soul_coin_delta integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id),
  constraint player_progress_mutation_id_length check (char_length(mutation_id) between 1 and 80),
  constraint player_progress_mutation_delta_range check (soul_coin_delta between -9999999 and 9999999)
);

alter table public.player_progress
  alter column mailbox set default '{"read":{},"claimed":{},"deleted":{}}'::jsonb;

create index if not exists player_progress_mutations_created_idx
  on public.player_progress_mutations (created_at);

create or replace function public.sc_jsonb_deep_merge(base jsonb, incoming jsonb)
returns jsonb
language plpgsql
immutable
parallel safe
as $$
declare
  result jsonb;
  entry record;
begin
  if jsonb_typeof(coalesce(base, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(incoming, '{}'::jsonb)) <> 'object' then
    return coalesce(incoming, base, 'null'::jsonb);
  end if;
  result := coalesce(base, '{}'::jsonb);
  for entry in select key, value from jsonb_each(coalesce(incoming, '{}'::jsonb)) loop
    result := jsonb_set(
      result,
      array[entry.key],
      case when result ? entry.key
        then public.sc_jsonb_deep_merge(result -> entry.key, entry.value)
        else entry.value end,
      true
    );
  end loop;
  return result;
end;
$$;

create or replace function public.merge_player_progress(
  p_user_id uuid,
  p_mutation_id text,
  p_soul_coin_delta integer,
  p_progress jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.player_progress%rowtype;
  mutation_applied boolean := false;
  mutation_rows integer := 0;
  safe_progress jsonb := coalesce(p_progress, '{}'::jsonb);
begin
  if p_user_id is null then raise exception 'user id is required'; end if;
  if p_mutation_id is null or char_length(p_mutation_id) < 1 or char_length(p_mutation_id) > 80 then
    raise exception 'invalid mutation id';
  end if;
  if jsonb_typeof(safe_progress) <> 'object' then raise exception 'progress must be an object'; end if;

  insert into public.player_progress (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into current_row
  from public.player_progress
  where user_id = p_user_id
  for update;

  insert into public.player_progress_mutations (user_id, mutation_id, soul_coin_delta)
  values (p_user_id, p_mutation_id, coalesce(p_soul_coin_delta, 0))
  on conflict (user_id, mutation_id) do nothing;
  get diagnostics mutation_rows = row_count;
  mutation_applied := mutation_rows > 0;

  update public.player_progress
  set
    soul_coins = case when mutation_applied
      then greatest(0, least(9999999, soul_coins + coalesce(p_soul_coin_delta, 0)))
      else soul_coins end,
    done = public.sc_jsonb_deep_merge(done, coalesce(safe_progress -> 'done', '{}'::jsonb)),
    pacts = public.sc_jsonb_deep_merge(pacts, coalesce(safe_progress -> 'pacts', '{}'::jsonb)),
    pets = public.sc_jsonb_deep_merge(pets, coalesce(safe_progress -> 'pets', '{}'::jsonb)),
    divine_offerings = public.sc_jsonb_deep_merge(divine_offerings, coalesce(safe_progress -> 'divineOfferings', '{}'::jsonb)),
    challenge_rewards = public.sc_jsonb_deep_merge(challenge_rewards, coalesce(safe_progress -> 'challengeRewards', '{}'::jsonb)),
    mailbox = public.sc_jsonb_deep_merge(mailbox, coalesce(safe_progress -> 'mailbox', '{}'::jsonb)),
    migrations = public.sc_jsonb_deep_merge(migrations, coalesce(safe_progress -> 'migrations', '{}'::jsonb)),
    revision = revision + case when mutation_applied then 1 else 0 end,
    updated_at = now()
  where user_id = p_user_id
  returning * into current_row;

  return jsonb_build_object(
    'ok', true,
    'mutationApplied', mutation_applied,
    'soulCoins', current_row.soul_coins,
    'done', current_row.done,
    'pacts', current_row.pacts,
    'pets', current_row.pets,
    'divineOfferings', current_row.divine_offerings,
    'challengeRewards', current_row.challenge_rewards,
    'mailbox', current_row.mailbox,
    'migrations', current_row.migrations,
    'revision', current_row.revision,
    'updated_at', current_row.updated_at
  );
end;
$$;

alter table public.player_progress enable row level security;
alter table public.player_progress_mutations enable row level security;

revoke all on table public.player_progress from anon, authenticated;
revoke all on table public.player_progress_mutations from anon, authenticated;
revoke all on function public.sc_jsonb_deep_merge(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.merge_player_progress(uuid, text, integer, jsonb) from public, anon, authenticated;

grant select, insert, update on table public.player_progress to service_role;
grant select, insert on table public.player_progress_mutations to service_role;
grant execute on function public.sc_jsonb_deep_merge(jsonb, jsonb) to service_role;
grant execute on function public.merge_player_progress(uuid, text, integer, jsonb) to service_role;

comment on table public.player_progress is
  'Authoritative Shadow Covenant player progress. Browser clients use the Netlify function; only service_role accesses this table.';
comment on table public.player_progress_mutations is
  'Idempotency ledger for atomic Soul Coin deltas and progress merges.';
