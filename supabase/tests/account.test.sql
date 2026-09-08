-- The account itself: what a player can take away, and what is left when they go.
--
-- Two users, A and B, each with rows in all seven user-owned tables. A exports, then A
-- deletes itself, and the file proves the two halves of docs/accounts-plan.md §3 rule 10:
--
--   X1  the export carries every one of the seven tables, the caller's rows only
--   X2  every column of those tables reaches the file — a column added later and not
--       exported fails here rather than quietly going missing from someone's data
--   D1  `delete_account()` leaves zero rows in all seven, because every one of them
--       hangs off `auth.users` by `on delete cascade`. The cascades are the thing under
--       test: they have never been fired before, only declared.
--   D2  and it takes exactly one account with it — B is untouched
--
-- Run with: npx supabase test db

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(17);


-- ──────────────────────────────────────────────────────────────────── seeding

-- Inserting into auth.users fires on_auth_user_created, so profiles and player_state
-- arrive by the same path a real sign-up takes. A is given more of everything than B, so
-- a scoping mistake shows up as the wrong count rather than as nothing at all.
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

update public.profiles
   set display_name = 'Ana', avatar_id = 'ace-spades'
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

update public.profiles
   set display_name = 'Ben'
 where user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

insert into public.answers
  (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l1', 0, 'a', true,
   now() - interval '2 hours', gen_random_uuid()),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l1', 1, 'b', false,
   now() - interval '1 hour', gen_random_uuid()),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'c1-l1', 0, 'b', false,
   now(), gen_random_uuid());

insert into public.lesson_completions
  (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'c1-l1', 'c1', 1, 2, now(), gen_random_uuid()),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'c1-l1', 'c1', 0, 1, now(), gen_random_uuid());

insert into public.chip_cases (user_id, colors, players, buy_in, auto_values)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '[]'::jsonb, 6, 500, true),
  ('bbbbbbbb-0000-4000-8000-000000000002', '[]'::jsonb, 5, 400, false);

insert into public.games (id, user_id, players, buy_in, dealt_stack, deal)
values
  ('cccccccc-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001',
   6, 500, 1900, '{}'::jsonb),
  ('cccccccc-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002',
   6, 500, 1900, '{}'::jsonb);

insert into public.game_seats (game_id, user_id, seat_index, name, end_points, balance_points)
values
  ('cccccccc-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001',
   0, 'Ana', 2100, 200),
  ('cccccccc-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001',
   1, 'Bea', 1700, -200),
  ('cccccccc-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000002',
   0, 'Ben', 2000, 100);


-- ───────────────────────────────────────────────────────────── X · the export

-- `auth.uid()` reads the JWT claims, not the role, so the document below is A's however
-- it is fetched. The claim is set once here and stands for the rest of the file.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

set local role authenticated;

select lives_ok(
  $$ select public.get_export() $$::text,
  'a signed-in player can export their own data'::text
);

reset role;

-- One snapshot, asserted against several times over. Taken as the owner so the temp
-- table does not depend on what `authenticated` is allowed to create.
create temporary table export_doc as select public.get_export() as doc;

select bag_eq(
  $$ select pg_catalog.json_object_keys(doc) from export_doc $$,
  $$ values ('exported_at'::text), ('user_id'), ('profile'), ('player_state'),
            ('answers'), ('lesson_completions'), ('chip_case'), ('games') $$,
  'X1 · the document carries all seven user-owned tables, and says when it was made'
);

select results_eq(
  $$ select doc->>'user_id' from export_doc $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::text) $$,
  'X1 · the id is stated once, at the top, rather than on every row'
);

select results_eq(
  $$ select doc->'profile'->>'display_name',
            doc->'player_state'->>'hearts',
            doc->'chip_case'->>'players'
       from export_doc $$,
  $$ values ('Ana'::text, '5'::text, '6'::text) $$,
  'X1 · the single-row tables come through as objects'
);

-- A has two answers to B's one, one completion to B's one, and a game of two seats to
-- B's one seat. Anything unscoped would show up here as a larger number.
select results_eq(
  $$ select pg_catalog.json_array_length(doc->'answers'),
            pg_catalog.json_array_length(doc->'lesson_completions'),
            pg_catalog.json_array_length(doc->'games'),
            pg_catalog.json_array_length(doc->'games'->0->'seats')
       from export_doc $$,
  $$ values (2, 1, 1, 2) $$,
  'X1 · and only the caller''s rows are in it'
);

-- X2 · The one that has to keep working after this is written. A column added to any of
-- the seven and not added to `get_export()` is data held on a player that their own copy
-- does not mention, which is the failure GDPR Article 15 is about. `user_id` is the
-- exception on purpose — it is the caller, and the document states it once above.
select is_empty(
  $$
  with exported as (
    select 'profiles'::text as table_name, k as column_name
      from export_doc, pg_catalog.json_object_keys(doc->'profile') k
    union all
    select 'player_state', k
      from export_doc, pg_catalog.json_object_keys(doc->'player_state') k
    union all
    select 'chip_cases', k
      from export_doc, pg_catalog.json_object_keys(doc->'chip_case') k
    union all
    select 'answers', k
      from export_doc,
           pg_catalog.json_array_elements(doc->'answers') a,
           pg_catalog.json_object_keys(a) k
    union all
    select 'lesson_completions', k
      from export_doc,
           pg_catalog.json_array_elements(doc->'lesson_completions') c,
           pg_catalog.json_object_keys(c) k
    union all
    select 'games', k
      from export_doc,
           pg_catalog.json_array_elements(doc->'games') g,
           pg_catalog.json_object_keys(g) k
    union all
    select 'game_seats', k
      from export_doc,
           pg_catalog.json_array_elements(doc->'games') g,
           pg_catalog.json_array_elements(g->'seats') s,
           pg_catalog.json_object_keys(s) k
  )
  select c.table_name::text, c.column_name::text
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name in ('profiles', 'player_state', 'answers', 'lesson_completions',
                          'chip_cases', 'games', 'game_seats')
     and c.column_name <> 'user_id'
     and not exists (
       select 1 from exported e
        where e.table_name = c.table_name
          and e.column_name = c.column_name
     )
  $$,
  'X2 · every column of every user-owned table reaches the export'
);


-- ─────────────────────────────────────────────────────────── D · the deletion

set local role authenticated;

select lives_ok(
  $$ select public.delete_account() $$::text,
  'a signed-in player can delete their own account'::text
);

reset role;

-- Counted as the owner, not as A: the point is that the rows are *gone*, not that RLS
-- has stopped showing them to a user who no longer exists.

select is_empty(
  $$ select 1 from public.profiles where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · the profile is gone'
);

select is_empty(
  $$ select 1 from public.player_state where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · the hearts and the streak are gone'
);

select is_empty(
  $$ select 1 from public.answers where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · every answer is gone'
);

select is_empty(
  $$ select 1 from public.lesson_completions
      where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · every completion is gone'
);

select is_empty(
  $$ select 1 from public.chip_cases where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · the chip case is gone'
);

select is_empty(
  $$ select 1 from public.games where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · every game is gone'
);

select is_empty(
  $$ select 1 from public.game_seats where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · and every seat at those games with them'
);

select is_empty(
  $$ select 1 from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'D1 · the account itself is gone, which is what took the rest'
);

-- D2 · One account, not the table. Names the table that lost a row rather than only
-- saying that one did.
select is_empty(
  $$ select 'profiles' where not exists (
       select 1 from public.profiles where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     union all
     select 'player_state' where not exists (
       select 1 from public.player_state where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     union all
     select 'answers' where not exists (
       select 1 from public.answers where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     union all
     select 'lesson_completions' where not exists (
       select 1 from public.lesson_completions
        where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     union all
     select 'chip_cases' where not exists (
       select 1 from public.chip_cases where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     union all
     select 'games' where not exists (
       select 1 from public.games where user_id = 'bbbbbbbb-0000-4000-8000-000000000002')
     union all
     select 'game_seats' where not exists (
       select 1 from public.game_seats where user_id = 'bbbbbbbb-0000-4000-8000-000000000002') $$,
  'D2 · B still has every row it had'
);


-- ────────────────────────────────────────────────────────── acting as nobody

-- The function would raise NOT_AUTHENTICATED on a null `auth.uid()`, but a signed-out
-- caller should not reach the body at all.
select set_config('request.jwt.claims', null, true);
set local role anon;

select throws_ok(
  $$ select public.get_export() $$::text,
  '42501'::text, null::text,
  'a signed-out caller cannot export anybody''s data'::text
);

reset role;

select * from finish();

rollback;
