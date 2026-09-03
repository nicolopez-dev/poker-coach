-- Poker Coach — the server-authoritative economy.
--
-- docs/accounts-plan.md §6 specifies hearts and streak exactly; this file follows that
-- pseudocode, including carrying the regen remainder in hearts_settled_at. §3 rule 3 is
-- why any of it lives here: player_state, answers and lesson_completions carry a select
-- policy and nothing else, so these functions are the only way the numbers move.
--
-- Every function is `security definer` with `set search_path = ''` and schema-qualifies
-- its references (§3 rule 4 — an unqualified definer function is an escalation hole),
-- and execute is revoked from public before being granted to authenticated.
--
-- settle_hearts and live_streak are pure, and are mirrored in TypeScript in
-- src/lib/hearts.ts and src/lib/streak.ts so the UI can move optimistically and offline
-- play has something to reason with. The shared cases are listed at the top of
-- supabase/tests/economy.test.sql, src/lib/hearts.test.ts and src/lib/streak.test.ts;
-- the two sides must agree case for case.
--
-- Inputs are prefixed p_ throughout. §6 writes settle_hearts(hearts, settled_at, at),
-- but a RETURNS TABLE column cannot share a name with a parameter, and `at` is a
-- keyword — the *result* columns are the ones §6 names.


-- ─────────────────────────────────────────────────────────────────────── hearts

-- One heart every four hours whenever below max, from the last one lost.
--
-- The remainder is the part that matters: a player three hours into a regen who loses a
-- heart must not lose those three hours, so the unspent part of the interval stays in
-- settled_at rather than being rounded away.
create function public.settle_hearts(
  p_hearts int,
  p_settled_at timestamptz,
  p_at timestamptz
)
returns table (hearts int, settled_at timestamptz)
language sql
immutable
security definer
set search_path = ''
as $$
  with regen as (
    select
      5 as max_hearts,
      interval '4 hours' as every,
      -- a backdated `at` grants nothing; it must never take hearts away either
      greatest(0, floor(
        extract(epoch from (p_at - p_settled_at)) / extract(epoch from interval '4 hours')
      ))::int as granted
  ),
  settled as (
    select
      r.max_hearts,
      r.every,
      r.granted,
      case
        when p_hearts >= r.max_hearts then r.max_hearts
        else least(r.max_hearts, p_hearts + r.granted)
      end as h
    from regen r
  )
  select
    s.h,
    case
      -- at full the clock idles: it restarts the moment a heart is spent
      when s.h >= s.max_hearts then p_at
      else p_settled_at + s.granted * s.every
    end
  from settled s;
$$;


-- ─────────────────────────────────────────────────────────────────────── streak

-- The streak as it stands today. The stored count is never zeroed on a lapse — a lapse
-- is derived here, so there is no cron job and no way for the stored and displayed
-- values to disagree (§6, "Losing a streak").
--
-- Yesterday still counts as alive: a player who did their lesson yesterday has until
-- their local midnight to keep the run, and the app must not tell them it is gone while
-- they can still save it.
create function public.live_streak(
  p_streak_count int,
  p_streak_day date,
  p_today_local date
)
returns int
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_streak_day is null then 0
    when p_today_local - p_streak_day <= 1 then p_streak_count
    else 0
  end;
$$;


-- ──────────────────────────────────────────────────────────────────── get_state

-- Settles the caller's hearts, persists the settlement, and returns everything the app
-- shows. XP and accuracy are derived from `answers` on every read rather than stored, so
-- a counter can never drift from the history that produced it (§4).
create function public.get_state()
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


-- ───────────────────────────────────────────────────────────────── submit_answer

-- The client sends what it picked, never whether it was right. The answer key in
-- content_questions decides (§3 rule 5), which is what makes XP and accuracy mean
-- something on a patched build.
create function public.submit_answer(
  p_lesson_id text,
  p_question_index int,
  p_chosen_option_id text,
  p_occurred_at timestamptz,
  p_tz_offset_min int,
  p_client_event_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_occurred timestamptz;
  v_tz int;
  v_state public.player_state;
  v_hearts int;
  v_settled_at timestamptz;
  v_key text;
  v_is_correct boolean;
  v_replayed boolean;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- §6: clamp both, and derive nothing from the client beyond these. The worst a
  -- patched build can do with occurred_at is backdate a week, which can only fail to
  -- advance a streak, never extend one.
  v_occurred := greatest(v_now - interval '7 days', least(p_occurred_at, v_now));
  v_tz := greatest(-840, least(840, coalesce(p_tz_offset_min, 0)));

  -- one writer per player: the lock makes the replay check and the heart spend below a
  -- single atomic step, so two copies of the outbox cannot both spend
  select * into v_state
    from public.player_state
   where user_id = v_user
     for update;

  if not found then
    raise exception 'NO_PLAYER_STATE' using errcode = 'P0002';
  end if;

  update public.player_state set tz_offset_min = v_tz where user_id = v_user;

  -- a replayed outbox entry returns what it returned the first time (§3 rule 9)
  select a.is_correct into v_is_correct
    from public.answers a
   where a.user_id = v_user and a.client_event_id = p_client_event_id;
  v_replayed := found;

  select s.hearts, s.settled_at into v_hearts, v_settled_at
    from public.settle_hearts(v_state.hearts, v_state.hearts_settled_at, v_now) s;

  if not v_replayed then
    if v_hearts = 0 then
      -- raise rather than record: the lesson is not completed and can be replayed from
      -- the start once a heart returns (§6, "Zero hearts")
      raise exception 'OUT_OF_HEARTS' using errcode = 'P0001';
    end if;

    select cq.correct_option_id into v_key
      from public.content_questions cq
     where cq.lesson_id = p_lesson_id and cq.question_index = p_question_index;

    if not found then
      raise exception 'UNKNOWN_QUESTION' using
        errcode = 'P0002',
        detail = p_lesson_id || ' #' || p_question_index || ' is not in the answer key';
    end if;

    v_is_correct := p_chosen_option_id = v_key;

    if not v_is_correct then
      -- spend(): from full, the regen clock starts at this instant
      if v_hearts >= 5 then
        v_settled_at := v_now;
      end if;
      v_hearts := v_hearts - 1;
    end if;

    insert into public.answers
      (user_id, lesson_id, question_index, chosen_option_id, is_correct, occurred_at, client_event_id)
    values
      (v_user, p_lesson_id, p_question_index, p_chosen_option_id, v_is_correct, v_occurred, p_client_event_id)
    on conflict (user_id, client_event_id) do nothing;
  end if;

  update public.player_state
     set hearts = v_hearts,
         hearts_settled_at = v_settled_at
   where user_id = v_user;

  return pg_catalog.json_build_object(
    'is_correct', v_is_correct,
    'hearts', v_hearts,
    'next_heart_at', case when v_hearts >= 5 then null else v_settled_at + interval '4 hours' end
  );
end;
$$;


-- ──────────────────────────────────────────────────────────────── complete_lesson

create function public.complete_lesson(
  p_lesson_id text,
  p_chapter_id text,
  p_occurred_at timestamptz,
  p_tz_offset_min int,
  p_client_event_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := pg_catalog.now();
  v_occurred timestamptz;
  v_tz int;
  v_day date;
  v_state public.player_state;
  v_correct int;
  v_total int;
  v_streak int;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  v_occurred := greatest(v_now - interval '7 days', least(p_occurred_at, v_now));
  v_tz := greatest(-840, least(840, coalesce(p_tz_offset_min, 0)));
  v_day := ((v_occurred at time zone 'UTC') + pg_catalog.make_interval(mins => v_tz))::date;

  select * into v_state
    from public.player_state
   where user_id = v_user
     for update;

  if not found then
    raise exception 'NO_PLAYER_STATE' using errcode = 'P0002';
  end if;

  -- A replay of the same event is a no-op, not an error (§3 rule 9). A *different*
  -- event for a lesson already finished is the error — a lesson completes once, so the
  -- streak cannot be farmed by replaying one lesson.
  perform 1 from public.lesson_completions lc
   where lc.user_id = v_user and lc.client_event_id = p_client_event_id;
  if found then
    return public.get_state();
  end if;

  perform 1 from public.lesson_completions lc
   where lc.user_id = v_user and lc.lesson_id = p_lesson_id;
  if found then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  -- the drill has to have actually been played, question by question
  select pg_catalog.count(*) filter (where a.is_correct), pg_catalog.count(*)
    into v_correct, v_total
    from public.answers a
   where a.user_id = v_user and a.lesson_id = p_lesson_id;

  if v_total = 0 then
    raise exception 'NO_ANSWERS' using errcode = 'P0001';
  end if;

  insert into public.lesson_completions
    (user_id, lesson_id, chapter_id, correct_count, question_count, occurred_at, client_event_id)
  values
    (v_user, p_lesson_id, p_chapter_id, v_correct, v_total, v_occurred, p_client_event_id);

  -- §6, the streak rule. A late offline event older than the run leaves it alone.
  v_streak := case
    when v_state.streak_day is null            then 1
    when v_day = v_state.streak_day            then v_state.streak_count
    when v_day = v_state.streak_day + 1        then v_state.streak_count + 1
    when v_day > v_state.streak_day + 1        then 1
    else v_state.streak_count
  end;

  update public.player_state
     set streak_count = v_streak,
         -- greatest ignores nulls, so a first completion sets the day
         streak_day = greatest(v_state.streak_day, v_day),
         longest_streak = greatest(v_state.longest_streak, v_streak),
         tz_offset_min = v_tz
   where user_id = v_user;

  return public.get_state();
end;
$$;


-- ─────────────────────────────────────────────────────────────────── set_profile

-- A null argument leaves that field alone: the avatar comes from a built-in set, so
-- there is nothing to clear.
create function public.set_profile(p_display_name text, p_avatar_id text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_avatar text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_display_name is not null
     and pg_catalog.char_length(p_display_name) not between 2 and 24 then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = 'P0001';
  end if;

  update public.profiles
     set display_name = coalesce(p_display_name, display_name),
         avatar_id = coalesce(p_avatar_id, avatar_id)
   where user_id = v_user
  returning display_name, avatar_id into v_name, v_avatar;

  if not found then
    raise exception 'NO_PROFILE' using errcode = 'P0002';
  end if;

  return pg_catalog.json_build_object('display_name', v_name, 'avatar_id', v_avatar);
end;
$$;


-- ──────────────────────────────────────────────────────────────── delete_account

-- Apple 5.1.1(v) and GDPR both require this. Everything else hangs off auth.users by
-- `on delete cascade`, so the one delete takes the lot.
create function public.delete_account()
returns void
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

  delete from auth.users where id = v_user;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────── grants

-- `anon` is revoked explicitly as well as through PUBLIC: Supabase grants execute to
-- anon, authenticated and service_role at creation time, and revoking from PUBLIC does
-- not touch a grant made to a role by name. Every one of these would raise
-- NOT_AUTHENTICATED for a signed-out caller anyway, but that guard is the second line,
-- not the gate.
revoke execute on function public.settle_hearts(int, timestamptz, timestamptz) from public, anon;
revoke execute on function public.live_streak(int, date, date) from public, anon;
revoke execute on function public.get_state() from public, anon;
revoke execute on function public.submit_answer(text, int, text, timestamptz, int, uuid) from public, anon;
revoke execute on function public.complete_lesson(text, text, timestamptz, int, uuid) from public, anon;
revoke execute on function public.set_profile(text, text) from public, anon;
revoke execute on function public.delete_account() from public, anon;

grant execute on function public.settle_hearts(int, timestamptz, timestamptz) to authenticated;
grant execute on function public.live_streak(int, date, date) to authenticated;
grant execute on function public.get_state() to authenticated;
grant execute on function public.submit_answer(text, int, text, timestamptz, int, uuid) to authenticated;
grant execute on function public.complete_lesson(text, text, timestamptz, int, uuid) to authenticated;
grant execute on function public.set_profile(text, text) to authenticated;
grant execute on function public.delete_account() to authenticated;
