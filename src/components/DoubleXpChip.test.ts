import { BASE_Y, FALL_AT, IMPACT, LOCK, poseAt } from './DoubleXpChip';

/** An angle folded into (−π, π], so whole turns stop mattering. */
const fold = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('the 2X XP chip', () => {
  it('stays out of sight while the lightning charges', () => {
    expect(poseAt(0).s).toBe(0);
    expect(poseAt(FALL_AT - 0.01).s).toBe(0);
    expect(poseAt(0.3).emissive).toBe(0);
  });

  it('drops in from above and lands at impact', () => {
    const falling = poseAt((FALL_AT + IMPACT) / 2);
    expect(falling.y).toBeGreaterThan(BASE_Y);
    expect(falling.s).toBeGreaterThan(0.6);
    expect(falling.s).toBeLessThan(1);

    const landed = poseAt(IMPACT);
    expect(landed.s).toBe(1);
    // squashed a hair into the table as it lands
    expect(landed.y).toBeLessThan(BASE_Y);
    expect(landed.sy).toBeLessThan(1);
    expect(landed.sx).toBeGreaterThan(1);
  });

  it('jolts the world at impact and settles', () => {
    expect(poseAt(IMPACT - 0.01).shake).toBe(0);
    expect(poseAt(IMPACT).shake).toBeGreaterThan(0);
    expect(poseAt(IMPACT + 1).shake).toBeLessThan(poseAt(IMPACT).shake / 100);
  });

  it('flares the gold hardest at impact', () => {
    // the flare starts the instant after the landing, as the design's `ki > 0` has it
    const flare = poseAt(IMPACT + 0.01).emissive;
    expect(flare).toBeGreaterThan(poseAt(IMPACT - 0.01).emissive);
    expect(flare).toBeGreaterThan(poseAt(IMPACT + 1).emissive);
    // and never goes dark once it has landed
    expect(poseAt(LOCK + 10).emissive).toBeGreaterThan(0.1);
  });

  it('spins down to face the player at the lock', () => {
    const locked = poseAt(LOCK);
    expect(fold(locked.ry)).toBeCloseTo(0, 6);
    expect(locked.rx).toBe(0);
    expect(locked.rz).toBe(0);
    expect(locked.y).toBeCloseTo(BASE_Y, 3);
  });

  it('only sways once it has locked, and never far', () => {
    for (let t = LOCK; t < LOCK + 20; t += 0.25) {
      const p = poseAt(t);
      expect(Math.abs(fold(p.ry))).toBeLessThan(0.17);
      expect(Math.abs(p.rx)).toBeLessThan(0.22);
      expect(Math.abs(p.y - BASE_Y)).toBeLessThan(0.0012);
    }
  });

  it('sweeps the sheen at the lock and every 2.4s after', () => {
    expect(poseAt(LOCK - 0.1).sheenAmt).toBe(0);
    expect(poseAt(LOCK + 0.3).sheenAmt).toBeGreaterThan(0);
    expect(poseAt(LOCK + 1.5).sheenAmt).toBe(0);
    expect(poseAt(LOCK + 2.4 + 0.3).sheenAmt).toBeGreaterThan(0);
  });
});
