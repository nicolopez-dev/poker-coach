-- The ante, proved against the SQL.
--
-- Fill the day's row of chips and the table offers a bet: every correct answer worth
-- double until you miss one. Only the instant it was taken is stored — where it ended is
-- read back out of `answers` — so these cases are really pinning that the window is a
-- derivation and cannot drift from the answers it covers.
--
--   D1  a fresh player is on no ante, and taking one is refused
--   D2  a full row opens it
--   D3  correct answers inside it are worth double
--   D4  a wrong answer closes it, and what follows is back to the ordinary rate
--   D5  one shot a day
--   D6  the two doublings do not stack — a clean-run drill inside an ante is still 16
--   D7  and midnight closes it even if nothing was ever missed
--
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(16);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('cccccccc-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'c@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

create temporary table u as
  select 'cccccccc-0000-4000-8000-000000000001'::uuid as id;

/** A finished drill: `p_correct` right, `p_wrong` wrong, all at one instant. */
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

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}', true);


-- ────────────────────────────────────────────────────────────────── D1 · closed

select is(
  (public.get_state() ->> 'double_live')::boolean, false,
  'D1 · a fresh player is on no ante'
);

select throws_ok(
  $$ select public.take_double() $$,
  'DAY_NOT_DONE',
  'D1 · and cannot take one before the day''s work is done'
);


-- ─────────────────────────────────────────────────────── D2 · the row fills up

-- The fixture's clock. Every event has to be **today** — the ante is only offered on the
-- day's own work, and both doublings now end at midnight — and also in the **past**: an
-- answer the wall clock has not reached is not one the player has given, which is what
-- `double_live` is asking about. So the whole timeline is laid out inside the part of
-- today that has already happened, however much of it there is when the suite runs.
create temporary table clock as
  select pg_catalog.date_trunc('day', now()) as midnight,
         (now() - pg_catalog.date_trunc('day', now())) / 20 as tick;

create or replace function pg_temp.at(p_tick int) returns timestamptz language sql as $$
  select (select c.midnight + c.tick * p_tick from clock c)
$$;

-- four drills is not five, however clean they are
select pg_temp.play('l1', 2, 1, pg_temp.at(1));
select pg_temp.play('l2', 2, 1, pg_temp.at(2));
select pg_temp.play('l3', 2, 1, pg_temp.at(3));
select pg_temp.play('l4', 2, 1, pg_temp.at(4));

select throws_ok(
  $$ select public.take_double() $$,
  'DAY_NOT_DONE',
  'D2 · four of five is still not the day'
);

select pg_temp.play('l5', 2, 1, pg_temp.at(5));

select is(
  (public.take_double() ->> 'double_live')::boolean, true,
  'D2 · the fifth opens it'
);

-- 5 drills × 2 right = 10 answers at the ordinary rate. Every one of them was played
-- before the ante, and taking a bet does not pay out backwards.
select is(public.player_xp((select id from u)), 80, 'D2 · and pays nothing for the past');

-- `take_double` stamps the bet at `now()`, which leaves no room after it for the drills
-- these cases play. Wound back onto the fixture's clock — still today, still after the
-- day's work — so that everything which follows the bet can also be behind us.
update public.player_state
   set double_from = pg_temp.at(6)
 where user_id = (select id from u);


-- ──────────────────────────────────────────────────────────── D3 · paying double

select pg_temp.play('l6', 2, 0, pg_temp.at(8));

select is(public.player_xp((select id from u)), 80 + 32, 'D3 · answers inside it are worth 16');

select is(
  (public.get_state() ->> 'double_live')::boolean, true,
  'D3 · and it is still running'
);


-- ─────────────────────────────────────────────────────────────── D4 · missing one

select pg_temp.play('l7', 1, 1, pg_temp.at(10));

select is(
  (public.get_state() ->> 'double_live')::boolean, false,
  'D4 · one wrong answer closes it'
);

-- l7's single right answer shares the instant of its wrong one, so it falls outside the
-- window on the boundary the function draws: `< ends`, not `<=`.
select is(public.player_xp((select id from u)), 80 + 32 + 8, 'D4 · the drill that missed pays 8');

select pg_temp.play('l8', 2, 0, pg_temp.at(12));
select is(
  public.player_xp((select id from u)), 80 + 32 + 8 + 16,
  'D4 · and everything after it is back to the ordinary rate'
);


-- ────────────────────────────────────────────────────────────── D5 · one a day

select throws_ok(
  $$ select public.take_double() $$,
  'ALREADY_DOUBLED',
  'D5 · the ante cannot be taken twice in a day'
);


-- ─────────────────────────────────────────────────── D6 · multipliers do not stack

-- A fresh player, so the two runs can be lined up cleanly: three clean drills in a row
-- inside a live ante. The third is doubled by the side bet *and* by the ante.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('cccccccc-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'd@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

update public.player_state
   set double_from = pg_temp.at(6)
 where user_id = 'cccccccc-0000-4000-8000-000000000002';

insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
select 'cccccccc-0000-4000-8000-000000000002', 'm' || g, 0, 'a', true,
       pg_temp.at(8), gen_random_uuid()
  from generate_series(1, 3) g;

insert into public.lesson_completions
  (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
select 'cccccccc-0000-4000-8000-000000000002', 'm' || g, 'c1', 1, 1,
       pg_temp.at(8 + g), gen_random_uuid()
  from generate_series(1, 3) g;

select is(
  (select pg_catalog.count(*)::int
     from public.doubled_lessons('cccccccc-0000-4000-8000-000000000002'::uuid)),
  1,
  'D6 · the third clean drill is the side bet''s'
);

-- three answers, all inside the ante, one of them also the side bet's: 3 × 16, not 2 × 16 + 32
select is(
  public.player_xp('cccccccc-0000-4000-8000-000000000002'::uuid), 48,
  'D6 · and it still pays 16, never 32'
);


-- ──────────────────────────────────────────────────────── D7 · last call

-- The bet is the day's. Only the instant it was taken is stored, so without a close of
-- its own a player who took one and then never missed would still be on it a week later
-- — which is the shape this pins: an ante taken yesterday pays for yesterday and stops
-- at midnight, whatever today's answers do.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values ('cccccccc-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'e@pokercoach.test', '',
        now(), now(), '{}'::jsonb, '{}'::jsonb);

update public.player_state
   set double_from = (select c.midnight - interval '14 hours' from clock c)  -- yesterday
 where user_id = 'cccccccc-0000-4000-8000-000000000003';

insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
values
  -- inside yesterday's ante
  ('cccccccc-0000-4000-8000-000000000003', 'n1', 0, 'a', true,
   (select c.midnight - interval '13 hours' from clock c), gen_random_uuid()),
  -- this morning, long after it closed, and nothing was ever answered wrong
  ('cccccccc-0000-4000-8000-000000000003', 'n2', 0, 'a', true,
   pg_temp.at(1), gen_random_uuid());

select is(
  (select w.ends from public.double_window('cccccccc-0000-4000-8000-000000000003'::uuid) w),
  (select c.midnight from clock c),
  'D7 · with nothing missed, the ante closes at the end of its own day'
);

select is(
  public.player_xp('cccccccc-0000-4000-8000-000000000003'::uuid), 16 + 8,
  'D7 · so yesterday''s answer is doubled and this morning''s is not'
);

select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(
  (public.get_state() ->> 'double_live')::boolean, false,
  'D7 · and the card stops saying it is running'
);

select * from finish();
rollback;
