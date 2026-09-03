/**
 * Hearts — the TypeScript half of the mirror.
 *
 * These cases are shared with `supabase/tests/economy.test.sql` and the two must agree
 * case for case. Changing one without the other is how the optimistic UI starts lying:
 *
 *   H1  regen across the 4-hour boundary — 3h59m grants nothing, 4h grants exactly one
 *   H2  the remainder survives a spend — three hours into a regen stay banked
 *   H3  the clock idles at full — settling moves settled_at, the count stays at max
 *   H4  spending from full starts the clock at that instant
 *   H5  regen never exceeds MAX_HEARTS
 *   H6  a backdated `at` grants nothing and takes nothing away
 */

import { MAX_HEARTS, OUT_OF_HEARTS, REGEN_MS, nextHeartAt, settle, spend } from './hearts';

const T0 = new Date('2026-08-30T08:00:00.000Z');

/** `T0` plus some hours, for readable cases. */
const after = (hours: number) => new Date(T0.getTime() + hours * 60 * 60 * 1000);

describe('settle', () => {
  it('H1 · grants nothing before the four-hour boundary', () => {
    const s = settle({ hearts: 3, settledAt: T0 }, new Date(T0.getTime() + REGEN_MS - 60_000));
    expect(s.hearts).toBe(3);
    expect(s.settledAt).toEqual(T0);
  });

  it('H1 · grants exactly one on the boundary', () => {
    const s = settle({ hearts: 3, settledAt: T0 }, after(4));
    expect(s.hearts).toBe(4);
    expect(s.settledAt).toEqual(after(4));
  });

  it('H1 · carries the remainder past the boundary', () => {
    // five hours is one heart and an hour banked towards the next
    const s = settle({ hearts: 3, settledAt: T0 }, after(5));
    expect(s.hearts).toBe(4);
    expect(s.settledAt).toEqual(after(4));
  });

  it('H3 · idles the clock at full', () => {
    const s = settle({ hearts: MAX_HEARTS, settledAt: T0 }, after(9));
    expect(s.hearts).toBe(MAX_HEARTS);
    expect(s.settledAt).toEqual(after(9));
  });

  it('H5 · never grants past the maximum, however long it has been', () => {
    const s = settle({ hearts: 1, settledAt: T0 }, after(100));
    expect(s.hearts).toBe(MAX_HEARTS);
    expect(s.settledAt).toEqual(after(100));
  });

  it('H6 · grants nothing for an instant before the settlement', () => {
    const s = settle({ hearts: 3, settledAt: T0 }, after(-5));
    expect(s.hearts).toBe(3);
    expect(s.settledAt).toEqual(T0);
  });

  it('is idempotent — settling twice at the same instant changes nothing', () => {
    const once = settle({ hearts: 3, settledAt: T0 }, after(5));
    expect(settle(once, after(5))).toEqual(once);
  });
});

describe('spend', () => {
  it('H2 · keeps the remainder banked', () => {
    // three hours into a regen: losing a heart must not lose those three hours
    const s = spend({ hearts: 3, settledAt: T0 }, after(3));
    expect(s.hearts).toBe(2);
    expect(s.settledAt).toEqual(T0);
  });

  it('H4 · starts the clock at this instant when spending from full', () => {
    const s = spend({ hearts: MAX_HEARTS, settledAt: T0 }, after(9));
    expect(s.hearts).toBe(4);
    expect(s.settledAt).toEqual(after(9));
  });

  it('spends the heart the wait just granted', () => {
    const s = spend({ hearts: 0, settledAt: T0 }, after(4));
    expect(s.hearts).toBe(0);
    expect(s.settledAt).toEqual(after(4));
  });

  it('rejects at zero rather than going negative', () => {
    expect(() => spend({ hearts: 0, settledAt: T0 }, after(1))).toThrow(OUT_OF_HEARTS);
  });
});

describe('nextHeartAt', () => {
  it('is null at full — there is no countdown to show', () => {
    expect(nextHeartAt({ hearts: MAX_HEARTS, settledAt: T0 }, after(9))).toBeNull();
  });

  it('is one interval past the settlement', () => {
    expect(nextHeartAt({ hearts: 3, settledAt: T0 }, after(1))).toEqual(after(4));
  });

  it('counts from the remainder, not from now', () => {
    // an hour into the second interval, the next heart is three hours out
    expect(nextHeartAt({ hearts: 3, settledAt: T0 }, after(5))).toEqual(after(8));
  });
});
