-- Poker Coach — the data export.
--
-- The other half of docs/accounts-plan.md §3 rule 10: deletion is already here, in
-- `delete_account()` from 20260830130000_economy.sql. This is what a player can take with
-- them instead of, or before, taking that door — GDPR Article 15 asks for a copy of the
-- data held on them, and Article 20 asks for it in a machine-readable form.
--
-- One function, one document. It reads the seven user-owned tables and nothing else:
--
--   profiles · player_state · answers · lesson_completions · chip_cases · games · game_seats
--
-- Those seven are exactly the tables that hang off `auth.users` by `on delete cascade`,
-- which is not a coincidence — what deletion takes away is what export hands over, and
-- supabase/tests/account.test.sql holds the two to that same list.
--
-- Every column of every one of them is exported, `user_id` aside: it is the caller,
-- repeated on every row, so it is stated once at the top of the document instead. The
-- column list is written out rather than taken from `to_jsonb(row)` so that nothing
-- reaches a player's file without having been put there on purpose; the coverage case in
-- account.test.sql is what stops a column added later being quietly left out.
--
-- `auth.users` is deliberately not read. The address and the provider are Supabase's
-- side of the account rather than the app's, and the player is looking at both on the
-- screen they signed in from — a definer function that reads the auth schema would be a
-- wider function for nothing they do not already have.
--
-- `security definer` with `set search_path = ''` and schema-qualified references (§3
-- rule 4), and execute revoked from public and anon before being granted to
-- authenticated, exactly as the P3 functions are.


create function public.get_export()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  return pg_catalog.json_build_object(
    'exported_at', pg_catalog.now(),
    -- said once here rather than on all several hundred rows below
    'user_id', v_user,

    'profile', (
      select pg_catalog.json_build_object(
               'display_name', p.display_name,
               'avatar_id', p.avatar_id,
               'created_at', p.created_at,
               'updated_at', p.updated_at
             )
        from public.profiles p
       where p.user_id = v_user
    ),

    'player_state', (
      select pg_catalog.json_build_object(
               'hearts', s.hearts,
               'hearts_settled_at', s.hearts_settled_at,
               'streak_count', s.streak_count,
               'streak_day', s.streak_day,
               'longest_streak', s.longest_streak,
               'tz_offset_min', s.tz_offset_min
             )
        from public.player_state s
       where s.user_id = v_user
    ),

    -- The whole history, oldest first, as it was recorded. `is_correct` is the server's
    -- own verdict against the answer key, which is the only reason it means anything.
    'answers', (
      select coalesce(pg_catalog.json_agg(
               pg_catalog.json_build_object(
                 'id', a.id,
                 'lesson_id', a.lesson_id,
                 'question_index', a.question_index,
                 'chosen_option_id', a.chosen_option_id,
                 'is_correct', a.is_correct,
                 'occurred_at', a.occurred_at,
                 'client_event_id', a.client_event_id
               ) order by a.occurred_at
             ), '[]'::json)
        from public.answers a
       where a.user_id = v_user
    ),

    'lesson_completions', (
      select coalesce(pg_catalog.json_agg(
               pg_catalog.json_build_object(
                 'id', lc.id,
                 'lesson_id', lc.lesson_id,
                 'chapter_id', lc.chapter_id,
                 'correct_count', lc.correct_count,
                 'question_count', lc.question_count,
                 'occurred_at', lc.occurred_at,
                 'client_event_id', lc.client_event_id
               ) order by lc.occurred_at
             ), '[]'::json)
        from public.lesson_completions lc
       where lc.user_id = v_user
    ),

    'chip_case', (
      select pg_catalog.json_build_object(
               'colors', c.colors,
               'players', c.players,
               'buy_in', c.buy_in,
               'auto_values', c.auto_values
             )
        from public.chip_cases c
       where c.user_id = v_user
    ),

    -- Seats hang under the game they were dealt at rather than in a list of their own:
    -- a seat means nothing without its game, and the file is meant to be read.
    'games', (
      select coalesce(pg_catalog.json_agg(
               pg_catalog.json_build_object(
                 'id', g.id,
                 'played_at', g.played_at,
                 'players', g.players,
                 'buy_in', g.buy_in,
                 'dealt_stack', g.dealt_stack,
                 'deal', g.deal,
                 -- the case the evening was played with, stored rather than derived
                 'colors', g.colors,
                 'auto_values', g.auto_values,
                 'client_event_id', g.client_event_id,
                 'seats', (
                   select coalesce(pg_catalog.json_agg(
                            pg_catalog.json_build_object(
                              'id', gs.id,
                              'game_id', gs.game_id,
                              'seat_index', gs.seat_index,
                              'name', gs.name,
                              'end_points', gs.end_points,
                              'balance_points', gs.balance_points
                            ) order by gs.seat_index
                          ), '[]'::json)
                     from public.game_seats gs
                    where gs.game_id = g.id
                 )
               ) order by g.played_at
             ), '[]'::json)
        from public.games g
       where g.user_id = v_user
    )
  );
end;
$$;


-- ─────────────────────────────────────────────────────────────────────── grants

-- `anon` by name as well as through PUBLIC: Supabase grants execute to anon,
-- authenticated and service_role at creation time, and revoking from PUBLIC does not
-- touch a grant made to a role by name.
revoke execute on function public.get_export() from public, anon;
grant execute on function public.get_export() to authenticated;
