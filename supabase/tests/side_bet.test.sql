-- The side bet, proved against the SQL.
--
-- Three drills in a row without a wrong answer and the third pays double, as does every
-- clean drill after it until one is slipped. Nothing is stored: the run and the payout
-- are read back out of `lesson_completions`, so what these cases really pin is that the
-- arithmetic is a pure function of the completions.
--
--   B1  a fresh player is on no run at all
--   B2  one and two clean drills pay the ordinary rate
--   B3  the third clean drill pays double — and only the third, not the ones before it
--   B4  a fourth clean drill keeps paying double
--   B5  slipping one ends the run, and the next clean drill is back to the ordinary rate
--   B6  a run that restarts has to reach three again before it pays
--   B7  answers to a lesson still in progress are never doubled
--   B8  the run is ordered by when a drill was played, not when it synced
--   B9  a run belongs to one day: midnight ends it, and yesterday keeps its payouts
--   B10 a slipped drill never counts towards a clean run, however they interleave
--
-- The fixtures are anchored to today rather than to a fixed date, because the run is
-- now counted within the player's own day and `clean_run` is the run they are on *now*.
--
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'b@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

create temporary table u as
  select 'bbbbbbbb-0000-4000-8000-000000000001'::uuid as id;

-- Midnight this morning. `tz_offset_min` is 0 for a player nobody has set one for, so the
-- player's day and the UTC day are the same one here, and a fixture at `+ 10 hours` is
-- unambiguously today whenever the suite is run.
create temporary table today as select pg_catalog.date_trunc('day', now()) as t;

-- Two correct answers per lesson, so a doubled lesson is worth 32 and a plain one 16 —
-- far enough apart that a wrong total cannot look like a rounding slip.
create or replace function pg_temp.play(
  p_lesson text, p_correct int, p_wrong int, p_at timestamptz
) returns void language sql as $$
  insert into public.answers
    (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
  select (select id from u), p_lesson, i, 'a', true, p_at, gen_random_uuid()
    from generate_series(1, p_correct) i
  union all
  select (select id from u), p_lesson, 100 + i, 'b', false, p_at, gen_random_uuid()
    from generate_series(1, p_wrong) i;

  insert into public.lesson_completions
    (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
  values ((select id from u), p_lesson, 'c1', p_correct, p_correct + p_wrong, p_at,
          gen_random_uuid());
$$;

/** The hour of today the fixture was played at. */
create or replace function pg_temp.at(p_hours int) returns timestamptz language sql as $$
  select (select t from today) + pg_catalog.make_interval(hours => p_hours)
$$;


-- ─────────────────────────────────────────────────────────────────────── B1

select is(public.clean_run((select id from u)), 0, 'B1 · a fresh player is on no run');
select is(public.player_xp((select id from u)), 0, 'B1 · and has no XP');


-- ─────────────────────────────────────────────────────────────── B2 · one, two

select pg_temp.play('l1', 2, 0, pg_temp.at(10));
select is(public.clean_run((select id from u)), 1, 'B2 · one clean drill is a run of one');
select is(public.player_xp((select id from u)), 16, 'B2 · and pays the ordinary rate');

select pg_temp.play('l2', 2, 0, pg_temp.at(11));
select is(public.player_xp((select id from u)), 32, 'B2 · two clean drills still pay 8 an answer');


-- ────────────────────────────────────────────────────────────── B3 · the bet lands

select pg_temp.play('l3', 2, 0, pg_temp.at(12));
select is(public.clean_run((select id from u)), 3, 'B3 · three in a row');
-- 16 + 16 + 32: only the third doubles, the two before it are worth what they were
select is(public.player_xp((select id from u)), 64, 'B3 · and the third drill pays double');


-- ──────────────────────────────────────────────────────────────── B4 · it keeps paying

select pg_temp.play('l4', 2, 0, pg_temp.at(13));
select is(public.player_xp((select id from u)), 96, 'B4 · a fourth clean drill also pays double');


-- ────────────────────────────────────────────────────────────────── B5 · slipping

select pg_temp.play('l5', 2, 1, pg_temp.at(14));
select is(public.clean_run((select id from u)), 0, 'B5 · one wrong answer ends the run');
-- the slipped drill's two right answers still pay 8 each
select is(public.player_xp((select id from u)), 112, 'B5 · and it pays the ordinary rate');

select pg_temp.play('l6', 2, 0, pg_temp.at(15));
select is(public.clean_run((select id from u)), 1, 'B5 · the next clean drill starts a new run');


-- ────────────────────────────────────────────────────────────── B6 · earning it again

select pg_temp.play('l7', 2, 0, pg_temp.at(16));
select pg_temp.play('l8', 2, 0, pg_temp.at(17));
-- 112 + 16 (l6, above) + 16 (l7) + 32 (l8, third of the new run)
select is(public.player_xp((select id from u)), 176, 'B6 · a new run has to reach three again');


-- ─────────────────────────────────────────────────────── B7 · a lesson in progress

-- answers with no completion behind them: never part of a run, never doubled
insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
values ((select id from u), 'l9', 0, 'a', true, pg_temp.at(18), gen_random_uuid());

select is(public.player_xp((select id from u)), 184, 'B7 · an unfinished lesson pays the ordinary rate');


-- ─────────────────────────────────────────────────────────── B8 · a late sync

-- Played yesterday morning and only recorded now. It belongs at the *front* of the
-- history, and in yesterday's run rather than this one.
select pg_temp.play('l0', 2, 0, pg_temp.at(-15));
select is(public.clean_run((select id from u)), 3,
  'B8 · a late completion lands where it was played, and leaves the current run alone');

-- 184 + 16: it pays the ordinary rate as the first drill of the day it was played in.
-- A run is counted within a day, so a completion that turns up late can only ever change
-- the payouts of its *own* day — the price of deriving the payout rather than banking it
-- is paid where it was earned, and today's totals cannot move under the player.
select is(public.player_xp((select id from u)), 200,
  'B8 · and pays out in the day it turns out to have been part of');


-- ──────────────────────────────────────────────────────────── B9 · midnight

-- Yesterday ends on a run of three, which pays as any run does.
select pg_temp.play('l0b', 2, 0, pg_temp.at(-14));
select pg_temp.play('l0c', 2, 0, pg_temp.at(-13));

select is(
  (select r.pos from public.clean_run_positions((select id from u)) r where r.lesson_id = 'l1'),
  1::bigint,
  'B9 · however last night ended, the first drill of a day starts a new run'
);

-- 200 + 16 (l0b) + 32 (l0c, third of yesterday's run). Today's payouts do not move.
select is(public.player_xp((select id from u)), 248,
  'B9 · yesterday keeps its own payouts, and today is counted apart from them');


-- ──────────────────────────────────────────────────── B10 · interleaved slips

-- A player who wins one and drops the next, over and over, is never on a run of two —
-- the grouping that finds the runs has to keep clean and slipped drills apart, and this
-- is the shape that catches it when it does not.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'b2@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
select 'bbbbbbbb-0000-4000-8000-000000000002', 'k' || g, i, 'a', true,
       (select t from today) + pg_catalog.make_interval(hours => g), gen_random_uuid()
  from generate_series(1, 5) g, generate_series(1, 2) i;

-- every other one drops a question: clean, slipped, clean, slipped, clean
insert into public.lesson_completions
  (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
select 'bbbbbbbb-0000-4000-8000-000000000002', 'k' || g, 'c1', 2,
       case when g % 2 = 0 then 3 else 2 end,
       (select t from today) + pg_catalog.make_interval(hours => g), gen_random_uuid()
  from generate_series(1, 5) g;

select is(
  (select pg_catalog.max(r.pos)::int
     from public.clean_run_positions('bbbbbbbb-0000-4000-8000-000000000002'::uuid) r),
  1,
  'B10 · no clean drill is ever second in a run it is not in'
);

select is(
  (select pg_catalog.count(*)::int
     from public.doubled_lessons('bbbbbbbb-0000-4000-8000-000000000002'::uuid)),
  0,
  'B10 · and nothing pays double'
);

select * from finish();
rollback;
