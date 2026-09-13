-- Poker Coach — both doublings are a day's affair, and the run is counted properly.
--
-- Three things, all of them about when a multiplier stops:
--
--   1. **A clean run belongs to one day.** It was counted over the whole history, so a
--      run begun last night carried into this morning and the third drill of "today"
--      could be the first one played. Runs are now cut at the player's own midnight, the
--      same boundary the streak uses.
--   2. **The ante closes at midnight too.** Only the instant it was taken was stored, and
--      the close was read as the next wrong answer — so a player who took the bet and
--      then answered nothing wrong was still on it days later. It now closes at the
--      earlier of the next wrong answer and the end of the day it was taken in.
--   3. **`clean_run_positions` was counting wrong.** The gaps-and-islands grouping keys
--      collide between clean and slipped drills — `n - row_number()` can land on the same
--      number for a clean island and a slipped one — and the final count partitioned by
--      that key alone, so a slipped drill sorted into a clean island and pushed every
--      position after it up by one. A history of alternating clean and slipped drills
--      therefore started paying on the *second* clean drill. The islands are now keyed by
--      the flag as well as the group, which is what the technique requires.
--
-- What has **not** changed: the two multipliers still do not stack (`player_xp` is one
-- `when/when/else`), and a drill is still worth what it was worth when it was played —
-- cutting runs at midnight is what keeps yesterday's payouts yesterday's, since a past
-- day's positions no longer move when today's are counted.


-- ──────────────────────────────────────────────────────────── the player's day

-- The date it is where the player is. `get_state` computes this inline for its own use;
-- this is the same arithmetic for the derivations that need it away from that function.
create or replace function public.player_day(p_user uuid, p_at timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select ((p_at at time zone 'UTC')
          + pg_catalog.make_interval(mins => ps.tz_offset_min))::date
    from public.player_state ps
   where ps.user_id = p_user
$$;

comment on function public.player_day(uuid, timestamptz) is
  'The calendar date of an instant in the player''s own timezone.';


-- ────────────────────────────────────────────────────────────────── the run

-- Every completion with its place in its day's run of clean drills: `pos` counts from 1
-- within a stretch of consecutive clean completions **inside one local day**, and is null
-- for a slipped one.
--
-- Dropped rather than replaced: the day comes back with the row now.
drop function if exists public.clean_run_positions(uuid);

create function public.clean_run_positions(p_user uuid)
returns table (lesson_id text, day date, n bigint, clean boolean, pos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with ordered as (
    select lc.lesson_id,
           ((lc.occurred_at at time zone 'UTC')
            + pg_catalog.make_interval(mins => ps.tz_offset_min))::date as day,
           (lc.correct_count = lc.question_count) as clean,
           -- lesson_id breaks a tie so the order is total, not merely deterministic-ish
           row_number() over (order by lc.occurred_at, lc.lesson_id) as n
      from public.lesson_completions lc
      join public.player_state ps on ps.user_id = lc.user_id
     where lc.user_id = p_user
  ),
  -- gaps and islands: consecutive rows sharing `clean` keep a constant difference between
  -- their overall position and their position among rows of that kind. The difference is
  -- only unique *within* a kind — a clean island and a slipped one can land on the same
  -- number — so `clean` has to be carried into every partition that uses it, and `day`
  -- with it, which is what stops a run crossing midnight.
  islands as (
    select o.lesson_id, o.day, o.clean, o.n,
           o.n - row_number() over (partition by o.day, o.clean order by o.n) as grp
      from ordered o
  )
  select i.lesson_id,
         i.day,
         i.n,
         i.clean,
         case when i.clean
              then row_number() over (partition by i.day, i.clean, i.grp order by i.n)
              else null
         end as pos
    from islands i
$$;

comment on function public.clean_run_positions(uuid) is
  'Each completion''s place in its day''s run of clean drills; null for one that dropped a heart.';

-- How many clean drills the player is on **today** — 0 the moment one is slipped, and 0
-- again when the day turns over. This is what the side-bet card counts out.
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
     where r.day = public.player_day(p_user, pg_catalog.now())
     order by r.n desc
     limit 1
  ), 0)::int
$$;

comment on function public.clean_run(uuid) is
  'Length of the player''s current unbroken run of clean drills, within today.';


-- ─────────────────────────────────────────────────────────────── the window

-- When the ante started and when it ended. `ends` is no longer open-ended: the bet is the
-- day's, so it closes at the earlier of the next wrong answer and the end of the day it
-- was taken in. `least` ignores nulls, which is exactly the fall-back wanted — no wrong
-- answer means midnight closes it.
create or replace function public.double_window(p_user uuid)
returns table (starts timestamptz, ends timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ps.double_from,
         least(
           (select pg_catalog.min(a.occurred_at)
              from public.answers a
             where a.user_id = p_user
               and not a.is_correct
               and a.occurred_at >= ps.double_from),
           ((public.player_day(p_user, ps.double_from) + 1)::timestamp
            - pg_catalog.make_interval(mins => ps.tz_offset_min)) at time zone 'UTC'
         )
    from public.player_state ps
   where ps.user_id = p_user
     and ps.double_from is not null
$$;

comment on function public.double_window(uuid) is
  'The open and close of the player''s ante: the next wrong answer, or midnight, whichever came first.';


-- ────────────────────────────────────────────────────────────────────── XP
--
-- Republished from 20260908160000 only to drop the `ends is null` arm, which used to mean
-- "still running" and can no longer happen — the window now always knows where it ends.
-- The shape is the point and has not moved: `when/when/else`, so an answer earns one
-- multiplier or the other and never both.

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
                  and a.occurred_at < w.ends
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

revoke all on function public.player_day(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.clean_run_positions(uuid) from public, anon, authenticated;
revoke all on function public.clean_run(uuid) from public, anon, authenticated;
revoke all on function public.double_window(uuid) from public, anon, authenticated;
revoke all on function public.player_xp(uuid) from public, anon, authenticated;


-- ─────────────────────────────────────────────────────────────── get_state()
--
-- Republished whole, as every revision is — lifted from 20260908160000 with one key
-- changed. `double_live` used to be "no wrong answer yet"; now that the window closes on
-- its own at midnight, it is simply whether the close is still ahead of us.

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
    'double_live', exists (
      select 1 from public.double_window(v_user) w where v_now < w.ends),
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
