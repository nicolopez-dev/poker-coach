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
--
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'b@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

create temporary table u as
  select 'bbbbbbbb-0000-4000-8000-000000000001'::uuid as id;

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


-- ─────────────────────────────────────────────────────────────────────── B1

select is(public.clean_run((select id from u)), 0, 'B1 · a fresh player is on no run');
select is(public.player_xp((select id from u)), 0, 'B1 · and has no XP');


-- ─────────────────────────────────────────────────────────────────── B2 · one, two

select pg_temp.play('l1', 2, 0, '2026-09-01T10:00:00Z');
select is(public.clean_run((select id from u)), 1, 'B2 · one clean drill is a run of one');
select is(public.player_xp((select id from u)), 16, 'B2 · and pays the ordinary rate');

select pg_temp.play('l2', 2, 0, '2026-09-01T11:00:00Z');
select is(public.player_xp((select id from u)), 32, 'B2 · two clean drills still pay 8 an answer');


-- ────────────────────────────────────────────────────────────── B3 · the bet lands

select pg_temp.play('l3', 2, 0, '2026-09-01T12:00:00Z');
select is(public.clean_run((select id from u)), 3, 'B3 · three in a row');
-- 16 + 16 + 32: only the third doubles, the two before it are worth what they were
select is(public.player_xp((select id from u)), 64, 'B3 · and the third drill pays double');


-- ──────────────────────────────────────────────────────────────── B4 · it keeps paying

select pg_temp.play('l4', 2, 0, '2026-09-01T13:00:00Z');
select is(public.player_xp((select id from u)), 96, 'B4 · a fourth clean drill also pays double');


-- ────────────────────────────────────────────────────────────────── B5 · slipping

select pg_temp.play('l5', 2, 1, '2026-09-01T14:00:00Z');
select is(public.clean_run((select id from u)), 0, 'B5 · one wrong answer ends the run');
-- the slipped drill's two right answers still pay 8 each
select is(public.player_xp((select id from u)), 112, 'B5 · and it pays the ordinary rate');

select pg_temp.play('l6', 2, 0, '2026-09-01T15:00:00Z');
select is(public.clean_run((select id from u)), 1, 'B5 · the next clean drill starts a new run');


-- ────────────────────────────────────────────────────────────── B6 · earning it again

select pg_temp.play('l7', 2, 0, '2026-09-01T16:00:00Z');
select pg_temp.play('l8', 2, 0, '2026-09-01T17:00:00Z');
-- 112 + 16 (l6, above) + 16 (l7) + 32 (l8, third of the new run)
select is(public.player_xp((select id from u)), 176, 'B6 · a new run has to reach three again');


-- ─────────────────────────────────────────────────────── B7 · a lesson in progress

-- answers with no completion behind them: never part of a run, never doubled
insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
values ((select id from u), 'l9', 0, 'a', true, '2026-09-01T18:00:00Z', gen_random_uuid());

select is(public.player_xp((select id from u)), 184, 'B7 · an unfinished lesson pays the ordinary rate');


-- ─────────────────────────────────────────────────────────── B8 · a late sync

-- Played the day before l1 but only recorded now. It belongs at the *front* of the
-- history, so the run the player is currently on is untouched.
select pg_temp.play('l0', 2, 0, '2026-08-31T09:00:00Z');
select is(public.clean_run((select id from u)), 3,
  'B8 · a late completion lands where it was played, and leaves the current run alone');

-- But it does lengthen the run it landed in, and that run's third drill is now l2 rather
-- than l3 — so l2 is paid for retroactively. This is the price of deriving the payout
-- instead of banking it, and it is the honest answer: the run really was longer than the
-- app could see while the completion was stuck in the outbox. It can only ever be as
-- true as the history, which is why nothing is stored.
--
-- l0 16 · l1 16 · l2 32 · l3 32 · l4 32 · l5 16 · l6 16 · l7 16 · l8 32 · l9 8
select is(public.player_xp((select id from u)), 216,
  'B8 · and pays out the run it turns out to have been part of');

select * from finish();
rollback;
