/**
 * A wait, ticking.
 *
 * The value is *derived* from the clock on every tick rather than decremented, which is
 * what makes it survive a backgrounded app: timers stop while the phone is asleep, and
 * the first tick after it wakes reads the truth again. A cold start is the same story —
 * `nextHeartAt` comes back with the hydrated state, and the countdown picks up where the
 * world is, not where the app left off.
 *
 * Time is the server's: `clockOffset` is what the store captured at hydration, and
 * nothing here reads a bare `Date.now()` (§3 rule 8).
 *
 * Owning its own interval is the point. Only the component that calls this re-renders on
 * a tick, so the header pill can count down without waking the whole tree once a second.
 */

import { useEffect, useState } from 'react';

/** Milliseconds until `target`, or 0 when there is nothing to wait for. */
function left(targetMs: number, clockOffset: number): number {
  if (Number.isNaN(targetMs)) return 0;
  return Math.max(0, targetMs - (Date.now() + clockOffset));
}

export function useCountdown(target: string | null, clockOffset: number): number {
  const targetMs = target ? Date.parse(target) : NaN;
  const [remaining, setRemaining] = useState(() => left(targetMs, clockOffset));

  useEffect(() => {
    if (Number.isNaN(targetMs)) {
      setRemaining(0);
      return;
    }

    setRemaining(left(targetMs, clockOffset));

    const id = setInterval(() => {
      const next = left(targetMs, clockOffset);
      setRemaining(next);
      // nothing left to count: stop rather than tick against a wall
      if (next === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [targetMs, clockOffset]);

  return remaining;
}
