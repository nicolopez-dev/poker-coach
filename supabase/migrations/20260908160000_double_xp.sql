-- Poker Coach — the ante on a finished day.
--
-- Fill the streak row — every drill of the day's work — and the table offers you a bet:
-- from here on every correct answer is worth double, until you miss one. Miss one and the
-- run is over; you get one shot a day.
--
-- Like the side bet (20260908120000), nothing about the payout is banked. The only thing
-- stored is **when the bet was taken**; where it ended is read back out of `answers` as
-- the first wrong one after that instant. So the two ends of the window are a fact and a
-- derivation, and there is no third copy to fall out of step with either.
--
-- The two doublings do **not** stack. An answer is worth 16 or it is worth 8; a drill
-- that is both the third of a clean run and inside an ante pays 16, not 32. Compounding
-- multipliers is how an economy stops meaning anything.


alter table public.player_state
  add column if not exists double_from timestamptz;

comment on column public.player_state.double_from is
  'When the day''s ante was taken. Where it ended is derived from the next wrong answer.';


-- ─────────────────────────────────────────────────────────────── the window

-- When the ante started and when it ended — `ends` null while it is still running. No
-- rows at all for a player who has never taken one.
create or replace function public.double_window(p_user uuid)
returns table (starts timestamptz, ends timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ps.double_from,
         (select pg_catalog.min(a.occurred_at)
            from public.answers a
           where a.user_id = p_user
             and not a.is_correct
             and a.occurred_at >= ps.double_from)
    from public.player_state ps
   where ps.user_id = p_user
     and ps.double_from is not null
$$;

comment on function public.double_window(uuid) is
  'The open and close of the player''s ante; ends is null while it is still live.';


-- ────────────────────────────────────────────────────────────────────── XP
--
-- Republished from 20260908120000 with the ante folded in. Deliberately `when/when/else`
-- rather than a sum: an answer earns one multiplier or the other, never both.

create or replace function public.player_xp(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.sum(
           case
             when a.lesson_id in (select d.lesson_id from public.doubled_lessons(p_user) d)
               then 16
             when exists (
               select 1 from public.double_window(p_user) w
                where a.occurred_at >= w.starts
                  and (w.ends is null or a.occurred_at < w.ends)
             ) then 16
             else 8
           end
         ), 0)::int
    from public.answers a
   where a.user_id = p_user
     and a.is_correct
$$;

comment on function public.player_xp(uuid) is
  'Total XP: 8 per correct answer, 16 inside a side-bet run or a live ante. Never 32.';

revoke all on function public.double_window(uuid) from public, anon, authenticated;
revoke all on function public.player_xp(uuid) from public, anon, authenticated;


-- ──────────────────────────────────────────────────────────── taking the bet

-- The day's work, in drills. Mirrors DAILY_GOAL in src/screens/HomeScreen.tsx — the row
-- of chips on the streak card is this many, and the ante is what filling it buys.
create or replace function public.daily_goal()
returns int language sql immutable set search_path = '' as $$ select 5 $$;

/**
 * Take the day's ante. Refused unless the row is full, and refused twice in a day.
 */
create or replace function public.take_double()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_state public.player_state;
  v_today date;
  v_done int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_state from public.player_state where user_id = v_user for update;
  if not found then
    raise exception 'NO_PLAYER_STATE' using errcode = 'P0002';
  end if;

  v_today := ((pg_catalog.now() at time zone 'UTC')
              + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date;

  select pg_catalog.count(*) into v_done
    from public.lesson_completions lc
   where lc.user_id = v_user
     and ((lc.occurred_at at time zone 'UTC')
          + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date = v_today;

  if v_done < public.daily_goal() then
    raise exception 'DAY_NOT_DONE' using errcode = 'P0001';
  end if;

  if v_state.double_from is not null
     and ((v_state.double_from at time zone 'UTC')
          + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date = v_today then
    raise exception 'ALREADY_DOUBLED' using errcode = 'P0001';
  end if;

  update public.player_state set double_from = pg_catalog.now() where user_id = v_user;

  return public.get_state();
end;
$$;

revoke all on function public.take_double() from public, anon;
grant execute on function public.take_double() to authenticated;


-- ─────────────────────────────────────────────────────────────── get_state()
--
-- Republished whole, as every revision is. Only two keys are new.

create or replace function public.get_state()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_state public.player_state;
  v_hearts int;
  v_settled_at timestamptz;
  v_today date;
  v_expires timestamptz;
  v_live int;
  v_correct int;
  v_total int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_state
    from public.player_state
   where user_id = v_user
     for update;

  if not found then
    raise exception 'NO_PLAYER_STATE' using errcode = 'P0002';
  end if;

  select s.hearts, s.settled_at into v_hearts, v_settled_at
    from public.settle_hearts(v_state.hearts, v_state.hearts_settled_at, v_now) s;

  update public.player_state
     set hearts = v_hearts,
         hearts_settled_at = v_settled_at
   where user_id = v_user;

  v_today := ((v_now at time zone 'UTC')
              + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date;
  v_expires := ((v_today + 1)::timestamp
                - pg_catalog.make_interval(mins => v_state.tz_offset_min)) at time zone 'UTC';

  v_live := public.live_streak(v_state.streak_count, v_state.streak_day, v_today);

  select pg_catalog.count(*) filter (where a.is_correct), pg_catalog.count(*)
    into v_correct, v_total
    from public.answers a
   where a.user_id = v_user;

  return pg_catalog.json_build_object(
    'hearts', v_hearts,
    'next_heart_at', case when v_hearts >= 5 then null else v_settled_at + interval '4 hours' end,
    'streak_count', v_live,
    'streak_at_risk', v_live > 0 and v_state.streak_day = v_today - 1,
    'streak_expires_at', v_expires,
    'longest_streak', v_state.longest_streak,
    'stored_streak_count', v_state.streak_count,
    'streak_day', v_state.streak_day,
    'xp', public.player_xp(v_user),
    'clean_run', public.clean_run(v_user),
    -- the ante is running: every correct answer is worth double until one is missed
    'double_live', coalesce(
      (select w.ends is null from public.double_window(v_user) w), false),
    -- and it has already been taken today, so it cannot be taken again
    'double_today', coalesce(
      ((v_state.double_from at time zone 'UTC')
       + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date = v_today, false),
    'accuracy', case when v_total = 0 then 0 else pg_catalog.round(v_correct::numeric / v_total, 4) end,
    'completed_lesson_ids', (
      select coalesce(pg_catalog.json_agg(lc.lesson_id order by lc.occurred_at), '[]'::json)
        from public.lesson_completions lc
       where lc.user_id = v_user
    ),

    'week', (
      select pg_catalog.json_agg(
               pg_catalog.json_build_object('day', d.day, 'answers', coalesce(n.answers, 0))
               order by d.day
             )
        from pg_catalog.generate_series(v_today - 6, v_today, interval '1 day') as g(day),
             lateral (select g.day::date as day) d
        left join lateral (
          select pg_catalog.count(*) as answers
            from public.answers a
           where a.user_id = v_user
             and ((a.occurred_at at time zone 'UTC')
                  + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date = d.day
        ) n on true
    ),

    'lessons_today', (
      select pg_catalog.count(*)
        from public.lesson_completions lc
       where lc.user_id = v_user
         and ((lc.occurred_at at time zone 'UTC')
              + pg_catalog.make_interval(mins => v_state.tz_offset_min))::date = v_today
    ),

    'chapters', (
      select coalesce(
               pg_catalog.json_object_agg(c.chapter_id, c.finished),
               '{}'::json
             )
        from (
          select lc.chapter_id, pg_catalog.count(*) as finished
            from public.lesson_completions lc
           where lc.user_id = v_user
           group by lc.chapter_id
        ) c
    ),

    'games', (
      select pg_catalog.count(*) from public.games g where g.user_id = v_user
    ),

    'server_now', v_now
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────── the export
--
-- A new column on a user-owned table is a new column the export owes them (GDPR
-- Article 15), and `account.test.sql` fails until it is named. Republished verbatim
-- from 20260907160000 with that one field added — everything else, down to the seats
-- nested under their game, is exactly as it was.
create or replace function public.get_export()
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
               'tz_offset_min', s.tz_offset_min,
               'double_from', s.double_from
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
