-- Poker Coach — the numbers the Home and You screens show.
--
-- `get_state()` already derives accuracy from `answers` and returns the finished lessons
-- in full, so "accuracy over all answers" and "total lessons completed" are here
-- already; adding them a second time would be two sources for one fact. What it cannot
-- answer yet:
--
--   · **the week** — answers per *local* day for the last seven days. Grouped by the
--     caller's own day, from the offset they last sent, exactly as the streak is (§6):
--     a chart drawn on UTC days would put an evening's work on the wrong bar for half
--     the world.
--   · **today** — lessons finished on the local day, for the daily goal.
--   · **per chapter** — completions grouped by chapter.
--   · **games** — how many have been recorded. Zero for everybody until P19 writes
--     them, which is the honest answer rather than a placeholder.
--
-- Still derived on every read, never stored (§4). A few hundred rows per player is
-- nothing for Postgres, and a counter that cannot drift is worth more than the cycles.
--
-- `create or replace` keeps the grants from 20260830130000_economy.sql.

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

  -- persisting the settlement is what keeps the remainder across reads
  update public.player_state
     set hearts = v_hearts,
         hearts_settled_at = v_settled_at
   where user_id = v_user;

  -- the caller's local day, derived from the offset they last sent (§6: the client
  -- sends an instant and an offset, never a date)
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
    -- XP_PER_ANSWER in src/content/types.ts; the two must stay in step
    'xp', v_correct * 8,
    'accuracy', case when v_total = 0 then 0 else pg_catalog.round(v_correct::numeric / v_total, 4) end,
    'completed_lesson_ids', (
      select coalesce(pg_catalog.json_agg(lc.lesson_id order by lc.occurred_at), '[]'::json)
        from public.lesson_completions lc
       where lc.user_id = v_user
    ),

    -- Seven local days ending today, oldest first, with a zero for the days nothing was
    -- played. The row for every day is what lets the chart keep its shape on a quiet
    -- week instead of collapsing to the days that happen to have data.
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
