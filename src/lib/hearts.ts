/**
 * Hearts — the client side of a deliberate mirror.
 *
 * `public.settle_hearts` in `supabase/migrations/20260830130000_economy.sql` is the
 * authority; this is the same arithmetic in TypeScript so the UI can move optimistically
 * and offline play has something to reason with. The duplication is the point, and the
 * risk: the two must agree case for case. The shared cases are listed at the top of
 * `hearts.test.ts` and of `supabase/tests/economy.test.sql`.
 *
 * Time comes from the server (§3 rule 8) — pass an `at` derived from the server-time
 * offset captured at hydration, never a bare `Date.now()`.
 */

/** Hearts a player carries into a drill; a wrong answer costs one. */
export const MAX_HEARTS = 5;

/** One heart returns every four hours whenever below max, from the last one lost. */
export const REGEN_MS = 4 * 60 * 60 * 1000;

/** What `spend` throws with when there is nothing left; matches the SQL's message. */
export const OUT_OF_HEARTS = 'OUT_OF_HEARTS';

export type HeartState = {
  hearts: number;
  /** when the count was last settled — this is what carries the regen remainder */
  settledAt: Date;
};

/**
 * Grants whatever whole intervals have elapsed. The remainder stays in `settledAt`:
 * a player three hours into a regen must not lose those three hours.
 */
export function settle(state: HeartState, at: Date): HeartState {
  // at full the clock idles; it restarts the moment a heart is spent
  if (state.hearts >= MAX_HEARTS) return { hearts: MAX_HEARTS, settledAt: at };

  // a backdated `at` grants nothing, and must never take hearts away either
  const granted = Math.max(0, Math.floor((at.getTime() - state.settledAt.getTime()) / REGEN_MS));
  const hearts = Math.min(MAX_HEARTS, state.hearts + granted);

  return {
    hearts,
    settledAt:
      hearts >= MAX_HEARTS
        ? at
        : new Date(state.settledAt.getTime() + granted * REGEN_MS),
  };
}

/** Settles, then takes one. Throws `OUT_OF_HEARTS` rather than going negative. */
export function spend(state: HeartState, at: Date): HeartState {
  const settled = settle(state, at);
  if (settled.hearts === 0) throw new Error(OUT_OF_HEARTS);

  return {
    hearts: settled.hearts - 1,
    // spending from full is what starts the clock, at this instant
    settledAt: settled.hearts === MAX_HEARTS ? at : settled.settledAt,
  };
}

/**
 * A wait, as the app says it: "3:41" for hours and minutes once there is an hour or
 * more left, "41:20" for minutes and seconds under it. The regen interval is four
 * hours, so the first form never runs past a single digit of hours.
 *
 * Rounded up, so the last second reads "0:01" rather than "0:00" — a countdown that
 * sits on zero while the heart is still coming is a small lie.
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** When the next heart lands, or null at full — there is no countdown to show. */
export function nextHeartAt(state: HeartState, at: Date): Date | null {
  const settled = settle(state, at);
  if (settled.hearts >= MAX_HEARTS) return null;
  return new Date(settled.settledAt.getTime() + REGEN_MS);
}
