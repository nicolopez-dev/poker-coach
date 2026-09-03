-- Row level security, proved rather than assumed.
--
-- Two seeded users, A and B, each with a row in every user-owned table. The tests below
-- prove that A cannot see or touch anything of B's, and — the point of docs/accounts-plan.md
-- §3 rule 3 — that A cannot write its own hearts, answers or completions either. Those
-- move only through the security definer functions in P3.
--
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(27);


-- ──────────────────────────────────────────────────────────────────── seeding

-- A and B. Inserting into auth.users fires on_auth_user_created, so profiles and
-- player_state are provisioned by the same path a real sign-up takes.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'a@pokercoach.test', '',
   now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'b@pokercoach.test', '',
   now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l1', 0, 'a', true,  now(), gen_random_uuid()),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'c1-l1', 0, 'b', false, now(), gen_random_uuid());

insert into public.lesson_completions
  (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l1', 'c1', 5, 5, now(), gen_random_uuid()),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'c1-l1', 'c1', 4, 5, now(), gen_random_uuid());

insert into public.chip_cases (user_id, colors, players, buy_in, auto_values)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '[]'::jsonb, 6, 500, true),
  ('bbbbbbbb-0000-4000-8000-000000000002', '[]'::jsonb, 6, 500, true);

insert into public.games (id, user_id, players, buy_in, dealt_stack)
values
  ('cccccccc-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 6, 500, 1900),
  ('cccccccc-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002', 6, 500, 1900);

insert into public.game_seats (game_id, user_id, seat_index, name, end_points, balance_points)
values
  ('cccccccc-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 0, 'Ana', 2000, 100),
  ('cccccccc-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002', 0, 'Ben', 2000, 100);

insert into public.content_questions
  (chapter_id, lesson_id, question_index, correct_option_id, option_ids)
values ('c1', 'c1-l1', 0, 'a', array['a', 'b', 'c']);


-- ──────────────────────────────────────────────────────────── the shape of it

select is_empty(
  $$ select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has row level security enabled'
);

-- Scoped to the two users seeded above rather than counting the table: these run
-- against whatever database is to hand, which on a dev machine has other accounts in it.
select results_eq(
  $$ select count(*)::int from public.profiles
      where user_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                        'bbbbbbbb-0000-4000-8000-000000000002') $$,
  $$ values (2) $$,
  'the auth.users trigger provisions a profile for every new user'
);

select results_eq(
  $$ select hearts, streak_count, longest_streak from public.player_state
      where user_id in ('aaaaaaaa-0000-4000-8000-000000000001',
                        'bbbbbbbb-0000-4000-8000-000000000002')
      order by user_id $$,
  $$ values (5, 0, 0), (5, 0, 0) $$,
  'the trigger provisions player_state at five hearts and no streak'
);


-- ───────────────────────────────────────────────────────── acting as user A

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- A cannot read B's rows in any user-owned table. Each of these seeds two rows and
-- expects to see exactly one — its own.

select results_eq(
  $$ select user_id from public.profiles $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only its own profile'
);

select results_eq(
  $$ select user_id from public.player_state $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only its own player_state'
);

select results_eq(
  $$ select user_id from public.answers $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only its own answers'
);

select results_eq(
  $$ select user_id from public.lesson_completions $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only its own lesson completions'
);

select results_eq(
  $$ select user_id from public.chip_cases $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only its own chip case'
);

select results_eq(
  $$ select user_id from public.games $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only its own games'
);

select results_eq(
  $$ select user_id from public.game_seats $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$,
  'A sees only the seats of its own games'
);


-- The economy is closed to the client. No insert, update or delete policy exists on
-- these tables and no privilege is granted, so a patched client has nothing to aim at.

select throws_ok(
  $$ update public.player_state set hearts = 5 $$::text,
  '42501'::text, null::text,
  'A cannot set its own hearts'::text
);

select throws_ok(
  $$ insert into public.answers
       (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l2', 0, 'a', true, now(), gen_random_uuid()) $$::text,
  '42501'::text, null::text,
  'A cannot write an answer directly'::text
);

select throws_ok(
  $$ update public.answers set is_correct = true $$::text,
  '42501'::text, null::text,
  'A cannot rewrite an answer it already gave'::text
);

select throws_ok(
  $$ insert into public.lesson_completions
       (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l2', 'c1', 5, 5, now(), gen_random_uuid()) $$::text,
  '42501'::text, null::text,
  'A cannot mark a lesson complete directly'::text
);

select throws_ok(
  $$ delete from public.lesson_completions $$::text,
  '42501'::text, null::text,
  'A cannot delete a completion to replay a lesson'::text
);


-- Nothing of B's can be written either, whether by aiming an update at B's row or by
-- claiming B's user_id on an insert.

with updated as (
  update public.profiles set display_name = 'not yours'
  where user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
  returning 1
)
select is((select count(*)::int from updated), 0, 'A''s update of B''s profile touches no rows');

select throws_ok(
  $$ insert into public.chip_cases (user_id, colors, players, buy_in, auto_values)
     values ('bbbbbbbb-0000-4000-8000-000000000002', '[]'::jsonb, 6, 500, true) $$::text,
  '42501'::text, null::text,
  'A cannot write a chip case under B''s id'::text
);

select throws_ok(
  $$ insert into public.games (user_id, players, buy_in, dealt_stack)
     values ('bbbbbbbb-0000-4000-8000-000000000002', 6, 500, 1900) $$::text,
  '42501'::text, null::text,
  'A cannot record a game under B''s id'::text
);

select throws_ok(
  $$ insert into public.game_seats (game_id, user_id, seat_index, end_points, balance_points)
     values ('cccccccc-0000-4000-8000-00000000000b',
             'aaaaaaaa-0000-4000-8000-000000000001', 1, 2000, 100) $$::text,
  '42501'::text, null::text,
  'A cannot add a seat to B''s game'::text
);


-- The answer key reads, but never writes.

select results_eq(
  $$ select correct_option_id from public.content_questions where lesson_id = 'c1-l1' $$,
  $$ values ('a'::text) $$,
  'A can read the answer key'
);

select throws_ok(
  $$ insert into public.content_questions
       (chapter_id, lesson_id, question_index, correct_option_id, option_ids)
     values ('c1', 'c1-l1', 1, 'a', array['a']) $$::text,
  '42501'::text, null::text,
  'A cannot write the answer key'::text
);


-- Positive controls: the policies are scoping access, not blanket-denying it.

select lives_ok(
  $$ insert into public.games (id, user_id, players, buy_in, dealt_stack)
     values ('dddddddd-0000-4000-8000-00000000000a',
             'aaaaaaaa-0000-4000-8000-000000000001', 6, 500, 1900) $$::text,
  'A can record a game of its own'::text
);

select lives_ok(
  $$ insert into public.game_seats (game_id, user_id, seat_index, name, end_points, balance_points)
     values ('dddddddd-0000-4000-8000-00000000000a',
             'aaaaaaaa-0000-4000-8000-000000000001', 0, 'Ana', 2100, 200) $$::text,
  'A can seat players at a game of its own'::text
);

select lives_ok(
  $$ update public.profiles set display_name = 'Ana'
     where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$::text,
  'A can rename itself'::text
);

select results_eq(
  $$ select display_name from public.profiles $$,
  $$ values ('Ana'::text) $$,
  'the rename stuck'
);

-- The column guard: the update policy lets A at its own row, the trigger decides which
-- columns of it are actually its own to change.
select throws_ok(
  $$ update public.profiles set created_at = '2000-01-01'
     where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$::text,
  '42501'::text, null::text,
  'A cannot change anything on its profile but the name and the avatar'::text
);


-- ────────────────────────────────────────────────────────── acting as nobody

reset role;
select set_config('request.jwt.claims', null, true);
set local role anon;

-- Login gates the app, so an unauthenticated caller gets nothing at all — not even the
-- option ids of a question.
select throws_ok(
  $$ select * from public.content_questions $$::text,
  '42501'::text, null::text,
  'a signed-out caller cannot read the answer key'::text
);


reset role;
select * from finish();

rollback;
