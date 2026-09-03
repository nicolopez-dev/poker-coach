/**
 * The streak — the TypeScript half of the mirror.
 *
 * These cases are shared with `supabase/tests/economy.test.sql` and the two must agree
 * case for case:
 *
 *   S1  a lesson today — alive, the stored count
 *   S2  a lesson yesterday — alive but at risk, still the stored count
 *   S3  a lesson two days ago — lapsed, zero
 *   S4  a null streak_day — zero
 *   S5  the local-midnight boundary either side — one instant, two offsets, two verdicts
 */

import { liveStreak, localDay, streakAtRisk } from './streak';

const TODAY = '2026-08-30';

describe('liveStreak', () => {
  it('S1 · counts a run extended today', () => {
    expect(liveStreak(7, '2026-08-30', TODAY)).toBe(7);
    expect(streakAtRisk('2026-08-30', TODAY)).toBe(false);
  });

  it('S2 · keeps a run extended yesterday, and calls it at risk', () => {
    // still savable until local midnight, so the app must not say it is gone
    expect(liveStreak(7, '2026-08-29', TODAY)).toBe(7);
    expect(streakAtRisk('2026-08-29', TODAY)).toBe(true);
  });

  it('S3 · lapses a run last extended two days ago', () => {
    expect(liveStreak(7, '2026-08-28', TODAY)).toBe(0);
    expect(streakAtRisk('2026-08-28', TODAY)).toBe(false);
  });

  it('S4 · reads zero when there is no run at all', () => {
    expect(liveStreak(0, null, TODAY)).toBe(0);
    expect(streakAtRisk(null, TODAY)).toBe(false);
  });

  it('crosses a month end without arithmetic trouble', () => {
    expect(liveStreak(7, '2026-08-31', '2026-09-01')).toBe(7);
    expect(liveStreak(7, '2026-08-31', '2026-09-02')).toBe(0);
  });
});

describe('localDay', () => {
  it('reads an instant in the device offset, not in UTC', () => {
    const at = new Date('2026-08-30T23:30:00.000Z');
    expect(localDay(at, 0)).toBe('2026-08-30');
    expect(localDay(at, 60)).toBe('2026-08-31');
    expect(localDay(at, -600)).toBe('2026-08-30');
  });

  it('handles the far ends of the clamp', () => {
    const at = new Date('2026-08-30T12:00:00.000Z');
    expect(localDay(at, 840)).toBe('2026-08-31'); // +14:00, Line Islands
    expect(localDay(at, -840)).toBe('2026-08-29'); // −14:00
  });
});

describe('S5 · the local-midnight boundary', () => {
  // One instant, two devices. At UTC it is still the 30th, so a run last extended on the
  // 29th is yesterday's and alive; an hour east it is already the 31st, and the same run
  // has lapsed. Which is exactly why the client sends an offset and the server derives
  // the day.
  const at = new Date('2026-08-30T23:30:00.000Z');

  it('keeps the run alive on the near side', () => {
    expect(liveStreak(7, '2026-08-29', localDay(at, 0))).toBe(7);
  });

  it('lapses it on the far side', () => {
    expect(liveStreak(7, '2026-08-29', localDay(at, 60))).toBe(0);
  });
});
