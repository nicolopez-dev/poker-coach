/**
 * The streak, as it stands today — the client side of a deliberate mirror.
 *
 * `public.live_streak` in `supabase/migrations/20260830130000_economy.sql` is the
 * authority. The shared cases are listed at the top of `streak.test.ts` and of
 * `supabase/tests/economy.test.sql`, and the two must agree case for case.
 *
 * See [[hearts]] for the other half of the mirror.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar day as `YYYY-MM-DD` — the shape a Postgres `date` takes in JSON. */
export type LocalDay = string;

/**
 * The local calendar day of an instant on a device whose UTC offset is `tzOffsetMin`.
 * Mirrors `(occurred_at + tz_offset_min)::date` on the server: the client sends the
 * instant and the offset and never a date, so a patched clock cannot invent a day (§6).
 */
export function localDay(at: Date, tzOffsetMin: number): LocalDay {
  return new Date(at.getTime() + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

/** Whole days from one local day to another. */
function daysBetween(from: LocalDay, to: LocalDay): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * The stored count if the last lesson was today or yesterday, zero once it has lapsed.
 *
 * Yesterday still counts as alive: a player who did their lesson yesterday has until
 * their local midnight to keep the run, and the app must not tell them it is gone while
 * they can still save it. The stored count is never zeroed — a lapse is derived here,
 * which is why there is no cron job and no way for stored and displayed to disagree.
 */
export function liveStreak(
  streakCount: number,
  streakDay: LocalDay | null,
  todayLocal: LocalDay,
): number {
  if (!streakDay) return 0;
  return daysBetween(streakDay, todayLocal) <= 1 ? streakCount : 0;
}

/** True while the run is alive but was last extended yesterday — the at-risk state. */
export function streakAtRisk(streakDay: LocalDay | null, todayLocal: LocalDay): boolean {
  return streakDay !== null && daysBetween(streakDay, todayLocal) === 1;
}
