-- Poker Coach — schema and row level security.
--
-- docs/accounts-plan.md §4 is the data model, §3 the security rules. Two of those rules
-- shape this file more than the rest:
--
--   · RLS on every table, default deny. A table with no policy for an action is closed,
--     which is the correct failure mode for anything added later without thinking.
--   · Hearts, streak and history are not client-writable. player_state, answers and
--     lesson_completions get a select policy and nothing else — every mutation goes
--     through the security definer functions added in P3.
--
-- Table grants are set at the end of the file rather than left to Supabase's
-- auto-expose default, so the intent reads in one place and a revoke cannot be undone
-- by an event trigger that ran at create time.


-- ─────────────────────────────────────────────────────────────────── profiles

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- null until the player picks one on the profile-setup screen
  display_name text check (char_length(display_name) between 2 and 24),
  avatar_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user, created by the auth.users trigger. Only display_name and avatar_id are user-editable.';


-- ─────────────────────────────────────────────────────────────── player_state

create table public.player_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hearts int not null default 5 check (hearts between 0 and 5),
  -- the instant the heart count was last settled; carries the regen remainder (§6)
  hearts_settled_at timestamptz not null default now(),
  streak_count int not null default 0 check (streak_count >= 0),
  -- the local day of the last completed lesson; a lapse is derived from it, never written
  streak_day date,
  longest_streak int not null default 0 check (longest_streak >= 0),
  tz_offset_min int not null default 0 check (tz_offset_min between -840 and 840)
);

comment on table public.player_state is
  'Server-authoritative hearts and streak. Readable by its owner, writable only by the P3 functions.';


-- ──────────────────────────────────────────────────────────────────── answers

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  question_index int not null,
  chosen_option_id text not null,
  -- decided by the server against content_questions, never asserted by the client
  is_correct boolean not null,
  occurred_at timestamptz not null,
  client_event_id uuid not null
);

-- replaying the offline outbox must not double-spend a heart
create unique index answers_user_event_key
  on public.answers (user_id, client_event_id);

-- the You screen reads history newest-first
create index answers_user_occurred_idx
  on public.answers (user_id, occurred_at desc);

comment on table public.answers is
  'Every answer ever given. XP and accuracy are derived from this table, never stored.';


-- ─────────────────────────────────────────────────────────── lesson_completions

create table public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  chapter_id text not null,
  correct_count int not null,
  question_count int not null,
  occurred_at timestamptz not null,
  client_event_id uuid not null
);

create unique index lesson_completions_user_event_key
  on public.lesson_completions (user_id, client_event_id);

-- a lesson completes once, however many times the outbox replays
create unique index lesson_completions_user_lesson_key
  on public.lesson_completions (user_id, lesson_id);


-- ────────────────────────────────────────────────────────── content_questions

-- Generated from src/content/course.ts by scripts/sync-content.ts (P4), never authored.
-- This is the answer key: it is what lets submit_answer decide right or wrong, so a
-- patched client cannot claim it was correct. See docs/accounts-plan.md §5.
create table public.content_questions (
  chapter_id text not null,
  lesson_id text not null,
  question_index int not null,
  correct_option_id text not null,
  option_ids text[] not null,
  primary key (lesson_id, question_index)
);


-- ────────────────────────────────────────────────────────────────── chip_cases

create table public.chip_cases (
  user_id uuid primary key references auth.users (id) on delete cascade,
  colors jsonb not null,
  players int not null,
  buy_in int not null,
  auto_values boolean not null default true
);


-- ────────────────────────────────────────────────────────────────────── games

create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  played_at timestamptz not null default now(),
  players int not null,
  buy_in int not null,
  dealt_stack int not null,
  deal jsonb,
  -- lets game_seats carry a composite key back to its parent, below
  unique (id, user_id)
);

create index games_user_played_idx
  on public.games (user_id, played_at desc);


-- ───────────────────────────────────────────────────────────────── game_seats

create table public.game_seats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat_index int not null,
  name text,
  end_points int not null default 0,
  balance_points int not null default 0,
  unique (game_id, seat_index),
  -- the composite reference is what makes a seat on someone else's game unrepresentable,
  -- rather than merely unreachable through the policy below
  foreign key (game_id, user_id)
    references public.games (id, user_id) on delete cascade
);


-- ──────────────────────────────────────────────────────── new-user provisioning

-- Every user gets a profile and a player_state row the moment they exist, so no code
-- path — sign-up, OAuth, an admin invite — can leave a user without state.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.player_state (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────────────── profile column guard

-- RLS grants access per row, not per column, so an `update profiles` policy would let a
-- user rewrite anything on their own row. Freeze everything except the two editable
-- columns by diffing the row rather than naming the frozen ones: a column added later is
-- then closed by default, which is the failure mode we want.
create function public.profiles_editable_columns_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'display_name'::text - 'avatar_id'::text - 'updated_at'::text
     is distinct from
     to_jsonb(old) - 'display_name'::text - 'avatar_id'::text - 'updated_at'::text
  then
    raise exception 'only display_name and avatar_id can be changed on a profile'
      using errcode = '42501';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_editable_columns_only
  before update on public.profiles
  for each row execute function public.profiles_editable_columns_only();


-- ───────────────────────────────────────────────────────── row level security

alter table public.profiles           enable row level security;
alter table public.player_state       enable row level security;
alter table public.answers            enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.content_questions  enable row level security;
alter table public.chip_cases         enable row level security;
alter table public.games              enable row level security;
alter table public.game_seats         enable row level security;

-- profiles — read and update own row. No insert policy: rows come from the trigger.
-- No delete policy: an account goes through delete_account(), and the row cascades.
create policy "profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles are updatable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- player_state, answers, lesson_completions — select and nothing else. There is
-- deliberately no insert, update or delete policy: these move only through P3's
-- security definer functions, so `update player_state set hearts = 5` has nothing to
-- match. This is rule 3 in §3, and the whole reason the economy is trustworthy.
create policy "player state is readable by its owner"
  on public.player_state for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "answers are readable by their owner"
  on public.answers for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "completions are readable by their owner"
  on public.lesson_completions for select to authenticated
  using ((select auth.uid()) = user_id);

-- content_questions — the answer key is readable by any signed-in player (they can see
-- the options in the app anyway) and writable by no one but the service role, which
-- bypasses RLS.
create policy "the answer key is readable when signed in"
  on public.content_questions for select to authenticated
  using (true);

-- chip_cases, games, game_seats — the player's own kit and their own record of it.
create policy "chip cases belong to their owner"
  on public.chip_cases for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "games belong to their owner"
  on public.games for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "game seats follow their parent game"
  on public.game_seats for all to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id = game_seats.game_id and g.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_seats.game_id and g.user_id = (select auth.uid())
    )
  );


-- ───────────────────────────────────────────────────────────────────── grants

-- anon gets nothing at all: login gates the app, so there is no unauthenticated read.
revoke all on
  public.profiles, public.player_state, public.answers, public.lesson_completions,
  public.content_questions, public.chip_cases, public.games, public.game_seats
  from anon, authenticated;

grant select, update on public.profiles to authenticated;

grant select on
  public.player_state, public.answers, public.lesson_completions,
  public.content_questions
  to authenticated;

grant select, insert, update, delete on
  public.chip_cases, public.games, public.game_seats
  to authenticated;
