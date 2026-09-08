-- Poker Coach — the side bet.
--
-- Three drills in a row without a wrong answer, and the third pays double: every correct
-- answer in it is worth 16 XP instead of 8, and so is every clean drill after it, until
-- one is slipped. The run then starts again from nothing.
--
-- Two properties this is built around:
--
--   · **Nothing is stored.** `lesson_completions` already records `correct_count` and
--     `question_count`, which is all "clean" means, so the run and the payout are both
--     derived on read exactly as XP already is (§4). There is no bonus to bank, no
--     marker for which run has been paid, and so nothing that can drift out of step with
--     the answers it is counting.
--   · **A clean drill's XP is the drill's own.** Doubling attaches to the *lesson*, not
--     to the day, so a player's total never changes retroactively — a drill is worth
--     what it was worth when they played it.
--
-- The run is ordered by `occurred_at`, which is the client's instant. A late offline
-- completion therefore lands in the run where it was played rather than where it synced,
-- which is the same rule §6 uses for the streak.


-- ────────────────────────────────────────────────────────────────── the run

-- Every completion with its place in the current run of clean drills: `pos` counts from
-- 1 within a stretch of consecutive clean completions and is null for a slipped one.
--
-- `stable`, not `immutable` — it reads a table.
create or replace function public.clean_run_positions(p_user uuid)
returns table (lesson_id text, n bigint, clean boolean, pos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with ordered as (
    select lc.lesson_id,
           (lc.correct_count = lc.question_count) as clean,
           -- lesson_id breaks a tie so the order is total, not merely deterministic-ish
           row_number() over (order by lc.occurred_at, lc.lesson_id) as n
      from public.lesson_completions lc
     where lc.user_id = p_user
  ),
  -- gaps and islands: consecutive rows sharing `clean` keep a constant difference
  -- between their overall position and their position among rows of that kind
  islands as (
    select o.lesson_id, o.clean, o.n,
           o.n - row_number() over (partition by o.clean order by o.n) as grp
      from ordered o
  )
  select i.lesson_id,
         i.n,
         i.clean,
         case when i.clean
              then row_number() over (partition by i.grp order by i.n)
              else null
         end as pos
    from islands i
$$;

comment on function public.clean_run_positions(uuid) is
  'Each completion''s place in its run of clean drills; null for a drill that dropped a heart.';

-- How many clean drills the player is on right now — 0 the moment one is slipped. This
-- is what the side-bet card counts out, so it has to be the *trailing* run and not the
-- longest one they ever had.
create or replace function public.clean_run(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case when r.clean then r.pos else 0 end
      from public.clean_run_positions(p_user) r
     order by r.n desc
     limit 1
  ), 0)::int
$$;

comment on function public.clean_run(uuid) is
  'Length of the player''s current unbroken run of clean drills.';

-- The lessons the side bet paid out on: third in a clean run or later.
create or replace function public.doubled_lessons(p_user uuid)
returns table (lesson_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.lesson_id
    from public.clean_run_positions(p_user) r
   where r.clean and r.pos >= 3
$$;

comment on function public.doubled_lessons(uuid) is
  'Lessons whose completion sat third or later in a run of clean drills, and so paid double XP.';


-- ────────────────────────────────────────────────────────────────────── XP

-- XP with the side bet applied. Answers to a lesson the bet paid out on are worth 16;
-- everything else, including answers to a lesson still in progress, is worth 8.
--
-- XP_PER_ANSWER lives in src/content/types.ts and the two must stay in step, as they
-- already did when this was a flat `count(*) * 8`.
create or replace function public.player_xp(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.sum(
           case when a.lesson_id in (select d.lesson_id from public.doubled_lessons(p_user) d)
                then 16 else 8 end
         ), 0)::int
    from public.answers a
   where a.user_id = p_user
     and a.is_correct
$$;

comment on function public.player_xp(uuid) is
  'Total XP: 8 per correct answer, doubled for lessons the side bet paid out on.';

revoke all on function public.clean_run_positions(uuid) from public, anon, authenticated;
revoke all on function public.clean_run(uuid) from public, anon, authenticated;
revoke all on function public.doubled_lessons(uuid) from public, anon, authenticated;
revoke all on function public.player_xp(uuid) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────── get_state()
--
-- Republished whole, as every revision of it has been: `create or replace` keeps the
-- grants from 20260830130000_economy.sql. The only changes from 20260906180000 are `xp`,
-- which now runs through `player_xp`, and `clean_run`, which the side-bet card counts.

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
    -- drills won clean, back to back; 3 is where the side bet starts paying
    'clean_run', public.clean_run(v_user),
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
