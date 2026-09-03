-- The economy, proved against the SQL.
--
-- H* and S* below are shared with src/lib/hearts.test.ts and src/lib/streak.test.ts.
-- The TypeScript mirror exists so the UI can move optimistically; it is only worth
-- having while it agrees with this file case for case, so change the two together:
--
--   H1  regen across the 4-hour boundary — 3h59m grants nothing, 4h grants exactly one
--   H2  the remainder survives a spend — three hours into a regen stay banked
--   H3  the clock idles at full — settling moves settled_at, the count stays at max
--   H4  spending from full starts the clock at that instant
--   H5  regen never exceeds MAX_HEARTS
--   H6  a backdated `at` grants nothing and takes nothing away
--
--   S1  a lesson today — alive, the stored count
--   S2  a lesson yesterday — alive but at risk, still the stored count
--   S3  a lesson two days ago — lapsed, zero
--   S4  a null streak_day — zero
--   S5  the local-midnight boundary either side — one instant, two offsets, two verdicts
--
-- Everything below E1 has no TypeScript counterpart: the server is the only place a
-- heart is actually spent.
--
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(48);


-- ──────────────────────────────────────────────────────────── H · settle_hearts

-- A fixed instant, so the cases read the same as the TypeScript ones.
create temporary table t0 as select timestamptz '2026-08-30T08:00:00Z' as at;

select results_eq(
  $$ select s.hearts, s.settled_at
       from t0, public.settle_hearts(3, t0.at, t0.at + interval '3 hours 59 minutes') s $$,
  $$ select 3, timestamptz '2026-08-30T08:00:00Z' $$,
  'H1 · nothing is granted before the four-hour boundary'
);

select results_eq(
  $$ select s.hearts, s.settled_at
       from t0, public.settle_hearts(3, t0.at, t0.at + interval '4 hours') s $$,
  $$ select 4, timestamptz '2026-08-30T12:00:00Z' $$,
  'H1 · exactly one heart is granted on the boundary'
);

select results_eq(
  $$ select s.hearts, s.settled_at
       from t0, public.settle_hearts(3, t0.at, t0.at + interval '5 hours') s $$,
  $$ select 4, timestamptz '2026-08-30T12:00:00Z' $$,
  'H1 · the remaining hour is carried, not rounded away'
);

select results_eq(
  $$ select s.hearts, s.settled_at
       from t0, public.settle_hearts(5, t0.at, t0.at + interval '9 hours') s $$,
  $$ select 5, timestamptz '2026-08-30T17:00:00Z' $$,
  'H3 · the clock idles at full'
);

select results_eq(
  $$ select s.hearts, s.settled_at
       from t0, public.settle_hearts(1, t0.at, t0.at + interval '100 hours') s $$,
  $$ select 5, timestamptz '2026-09-03T12:00:00Z' $$,
  'H5 · regen never grants past the maximum'
);

select results_eq(
  $$ select s.hearts, s.settled_at
       from t0, public.settle_hearts(3, t0.at, t0.at - interval '5 hours') s $$,
  $$ select 3, timestamptz '2026-08-30T08:00:00Z' $$,
  'H6 · a backdated instant grants nothing and takes nothing away'
);

select results_eq(
  $$ select s2.hearts, s2.settled_at
       from t0,
            public.settle_hearts(3, t0.at, t0.at + interval '5 hours') s1,
            public.settle_hearts(s1.hearts, s1.settled_at, t0.at + interval '5 hours') s2 $$,
  $$ select 4, timestamptz '2026-08-30T12:00:00Z' $$,
  'settling twice at the same instant changes nothing'
);


-- ────────────────────────────────────────────────────────────── S · live_streak

select is(public.live_streak(7, date '2026-08-30', date '2026-08-30'), 7,
  'S1 · a run extended today counts');

select is(public.live_streak(7, date '2026-08-29', date '2026-08-30'), 7,
  'S2 · a run extended yesterday is still alive');

select is(public.live_streak(7, date '2026-08-28', date '2026-08-30'), 0,
  'S3 · a run last extended two days ago has lapsed');

select is(public.live_streak(0, null, date '2026-08-30'), 0,
  'S4 · no run reads as zero');

-- S5 · one instant, two devices. At UTC it is still the 30th, so a run last extended on
-- the 29th is yesterday's and alive; an hour east it is already the 31st and the same
-- run has lapsed. This is why the client sends an offset and the server derives the day.
select is(
  ((timestamptz '2026-08-30T23:30:00Z' at time zone 'UTC') + make_interval(mins => 0))::date,
  date '2026-08-30',
  'S5 · the instant is the 30th at UTC'
);

select is(
  ((timestamptz '2026-08-30T23:30:00Z' at time zone 'UTC') + make_interval(mins => 60))::date,
  date '2026-08-31',
  'S5 · and the 31st an hour east'
);

select is(
  public.live_streak(7, date '2026-08-29',
    ((timestamptz '2026-08-30T23:30:00Z' at time zone 'UTC') + make_interval(mins => 0))::date),
  7,
  'S5 · the run is alive on the near side of local midnight'
);

select is(
  public.live_streak(7, date '2026-08-29',
    ((timestamptz '2026-08-30T23:30:00Z' at time zone 'UTC') + make_interval(mins => 60))::date),
  0,
  'S5 · and lapsed on the far side'
);


-- ──────────────────────────────────────────────────────────────────── E · seeding

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'a@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

-- The answer key: five questions on one lesson, plus one on a second lesson so
-- complete_lesson has something it has never been played.
insert into public.content_questions
  (chapter_id, lesson_id, question_index, correct_option_id, option_ids)
select 'c1', 'c1-l1', i, 'a', array['a', 'b', 'c'] from generate_series(0, 4) i;

insert into public.content_questions
  (chapter_id, lesson_id, question_index, correct_option_id, option_ids)
values ('c1', 'c1-l2', 0, 'a', array['a', 'b', 'c']);

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;


-- ────────────────────────────────────────────────────────── E · submit_answer

select is(
  (public.get_state() ->> 'hearts')::int, 5,
  'a new player starts at five hearts'
);

select is(
  (public.get_state() ->> 'next_heart_at'), null,
  'and has no countdown to show'
);

select is(
  (public.submit_answer('c1-l1', 0, 'a', now(), 60,
    '11111111-0000-4000-8000-00000000000a') ->> 'is_correct')::boolean,
  true,
  'the server decides a right answer is right'
);

select is(
  (public.get_state() ->> 'hearts')::int, 5,
  'a right answer costs nothing'
);

select is(
  (public.submit_answer('c1-l1', 1, 'c', now(), 60,
    '11111111-0000-4000-8000-00000000000b') ->> 'is_correct')::boolean,
  false,
  'and that a wrong one is wrong, whatever the client thinks'
);

select is(
  (public.get_state() ->> 'hearts')::int, 4,
  'a wrong answer costs one heart'
);

-- H4 · the spend was from full, so the clock started at that instant rather than
-- carrying a stale settled_at forward.
select ok(
  (select abs(extract(epoch from (now() - hearts_settled_at))) < 5
     from public.player_state where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'H4 · spending from full starts the regen clock now'
);

-- E1 · the outbox replays. The same event must return the same verdict and spend
-- nothing, or a flaky connection costs the player hearts they never lost.
select is(
  (public.submit_answer('c1-l1', 1, 'c', now(), 60,
    '11111111-0000-4000-8000-00000000000b') ->> 'is_correct')::boolean,
  false,
  'E1 · a replayed event returns the verdict it returned the first time'
);

select is(
  (public.get_state() ->> 'hearts')::int, 4,
  'E1 · and spends no second heart'
);

select is(
  (select count(*)::int from public.answers
    where client_event_id = '11111111-0000-4000-8000-00000000000b'),
  1,
  'E1 · leaving one answer row, not two'
);

-- H2 · three hours into a regen. The spend must leave those three hours banked.
reset role;
update public.player_state
   set hearts = 3, hearts_settled_at = now() - interval '3 hours'
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;

select is(
  (public.submit_answer('c1-l1', 2, 'b', now(), 60,
    '11111111-0000-4000-8000-00000000000c') ->> 'hearts')::int,
  2,
  'H2 · the wrong answer costs a heart'
);

select ok(
  (select abs(extract(epoch from (now() - interval '3 hours' - hearts_settled_at))) < 5
     from public.player_state where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'H2 · and the three hours already served stay banked'
);

-- E2 · at zero, submit_answer raises rather than going negative.
reset role;
update public.player_state
   set hearts = 0, hearts_settled_at = now()
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;

select throws_ok(
  $$ select public.submit_answer('c1-l1', 3, 'b', now(), 60,
       '11111111-0000-4000-8000-00000000000d') $$::text,
  'P0001'::text, 'OUT_OF_HEARTS'::text,
  'E2 · a wrong answer at zero hearts raises'::text
);

select is(
  (public.get_state() ->> 'hearts')::int, 0,
  'E2 · and leaves the count at zero, never below'
);

select is(
  (select count(*)::int from public.answers
    where client_event_id = '11111111-0000-4000-8000-00000000000d'),
  0,
  'E2 · the rejected answer is not recorded, so the lesson can be replayed'
);


-- ──────────────────────────────────────────────────────── E · complete_lesson

select throws_ok(
  $$ select public.complete_lesson('c1-l2', 'c1', now(), 60,
       '22222222-0000-4000-8000-00000000000a') $$::text,
  'P0001'::text, 'NO_ANSWERS'::text,
  'a lesson that was never played cannot be completed'
);

select is(
  (public.complete_lesson('c1-l1', 'c1', now(), 60,
    '22222222-0000-4000-8000-00000000000b') ->> 'streak_count')::int,
  1,
  'the first completion opens a streak of one'
);

select is(
  (public.complete_lesson('c1-l1', 'c1', now(), 60,
    '22222222-0000-4000-8000-00000000000b') ->> 'streak_count')::int,
  1,
  'replaying that completion is a no-op, not a second day'
);

select throws_ok(
  $$ select public.complete_lesson('c1-l1', 'c1', now(), 60,
       '22222222-0000-4000-8000-00000000000c') $$::text,
  'P0001'::text, 'ALREADY_COMPLETED'::text,
  'and a fresh event for the same lesson is refused — a lesson completes once'
);

select is(
  (select json_array_length(public.get_state() -> 'completed_lesson_ids')),
  1,
  'one lesson shows as completed'
);


-- ───────────────────────────────────────────────── E · the derived numbers

-- Three answers given, two of them right: XP is derived, never stored, so it cannot
-- drift from the history that produced it.
select is(
  (public.get_state() ->> 'xp')::int, 8,
  'xp is the correct answers times XP_PER_ANSWER'
);

select is(
  (public.get_state() ->> 'accuracy')::numeric, 0.3333::numeric,
  'accuracy is correct over total'
);

-- A lapse is derived on read and never written back.
reset role;
update public.player_state
   set streak_count = 7, streak_day = current_date - 5
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;

select is(
  (public.get_state() ->> 'streak_count')::int, 0,
  'a lapsed run reads as zero'
);

select is(
  (select streak_count from public.player_state
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  7,
  'but the stored count is never zeroed — the lapse is derived, not written'
);


-- ────────────────────────────────────────────────── E · profile and deletion

select is(
  public.set_profile('Ana', 'ace-of-spades') ->> 'display_name', 'Ana',
  'set_profile renames the caller'
);

select throws_ok(
  $$ select public.set_profile('A', null) $$::text,
  'P0001'::text, 'INVALID_DISPLAY_NAME'::text,
  'and refuses a name shorter than two characters'
);

select is(
  public.set_profile(null, 'king-of-hearts') ->> 'display_name', 'Ana',
  'a null argument leaves that field alone'
);

select lives_ok(
  $$ select public.delete_account() $$::text,
  'delete_account removes the caller'::text
);

reset role;

select is(
  (select count(*)::int from auth.users
    where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0,
  'the user is gone'
);

select is(
  (select count(*)::int from public.answers
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0,
  'and everything hanging off them cascaded away'
);


-- ──────────────────────────────────────────────────────── E · signed out

-- Every function would raise NOT_AUTHENTICATED for a null auth.uid(), but a signed-out
-- caller should not reach the body at all.
set local role anon;

select throws_ok(
  $$ select public.get_state() $$::text,
  '42501'::text, null::text,
  'a signed-out caller cannot execute get_state'::text
);

select throws_ok(
  $$ select public.submit_answer('c1-l1', 0, 'a', now(), 0, gen_random_uuid()) $$::text,
  '42501'::text, null::text,
  'nor submit_answer'::text
);

select throws_ok(
  $$ select public.delete_account() $$::text,
  '42501'::text, null::text,
  'nor delete_account'::text
);

reset role;

select * from finish();

rollback;
