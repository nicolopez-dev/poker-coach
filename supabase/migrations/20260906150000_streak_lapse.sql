-- Poker Coach — what a lapsed streak has to say for itself.
--
-- `get_state()` already resolves the streak through live_streak, so a run that has
-- lapsed reads as zero (docs/accounts-plan.md §6, "Losing a streak"). Two things the
-- client cannot work out from that answer alone:
--
--   · **the number that ended.** The resolved count is zero by then, and longest_streak
--     is a different fact — losing a thirty-day run when your best was forty should say
--     thirty. Only the stored count knows.
--   · **which lapse it is.** The card that acknowledges a lost run is shown once and
--     never nagged, so the client keys the acknowledgement on the day the run ended.
--
-- Both are read straight off `player_state` before the settlement below touches it, and
-- neither is written: a lapse stays derived (§6), so there is still no cron job and no
-- way for the stored and the displayed value to disagree.
--
-- `create or replace` keeps the existing grants — execute is already revoked from public
-- and anon and granted to authenticated by 20260830130000_economy.sql.

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
    -- the run as stored: equal to streak_count while it is alive, and the number that
    -- ended once it is not
    'stored_streak_count', v_state.streak_count,
    -- the local day it was last extended; null for a player who has never had one
    'streak_day', v_state.streak_day,
    -- XP_PER_ANSWER in src/content/types.ts; the two must stay in step
    'xp', v_correct * 8,
    'accuracy', case when v_total = 0 then 0 else pg_catalog.round(v_correct::numeric / v_total, 4) end,
    'completed_lesson_ids', (
      select coalesce(pg_catalog.json_agg(lc.lesson_id order by lc.occurred_at), '[]'::json)
        from public.lesson_completions lc
       where lc.user_id = v_user
    ),
    'server_now', v_now
  );
end;
$$;
