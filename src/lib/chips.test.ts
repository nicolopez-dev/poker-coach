import {
  AUTO_VALUES,
  VALUE_STEP,
  autoValued,
  availablePoints,
  deal,
  dealtRows,
  exactFit,
  fit,
  smallestDenom,
  snapValue,
  totalChips,
  undealtColors,
} from './chips';
import type { ChipColor } from './chips';
import { DEFAULT_COLORS } from '../data/chipCase';

const caseOf = (...counts: number[]): ChipColor[] =>
  DEFAULT_COLORS.map((c, i) => ({ ...c, count: counts[i] ?? c.count }));

describe('the values themselves', () => {
  it('is one fixed ladder, in fives, smallest first', () => {
    expect([...AUTO_VALUES]).toEqual([5, 10, 25, 50, 100, 500, 1000, 2000, 5000]);
    expect(AUTO_VALUES.every((v) => v % VALUE_STEP === 0)).toBe(true);
    expect([...AUTO_VALUES]).toEqual([...AUTO_VALUES].sort((a, b) => a - b));
  });

  it('rounds to the nearest five and never below one chip', () => {
    expect([0, 1, 2, 3, 7, 12, 13, 4999].map(snapValue)).toEqual([5, 5, 5, 5, 5, 10, 15, 5000]);
  });

  it('lays the ladder over a case, cheapest colour first', () => {
    const mine: ChipColor[] = [
      { name: 'Blue', swatch: '#3a4f6b', count: 10, value: 200 },
      { name: 'White', swatch: '#f4f1e6', count: 30, value: 15 },
      { name: 'Red', swatch: '#ff7a63', count: 20, value: 60 },
    ];
    const laddered = autoValued(mine);

    // the cheapest takes the first rung, and the order of the case is untouched
    expect(laddered.map((c) => [c.name, c.value])).toEqual([
      ['Blue', 25],
      ['White', 5],
      ['Red', 10],
    ]);
    expect(laddered.map((c) => c.count)).toEqual([10, 30, 20]);
  });

  it('leaves a colour it has no rung for as it was', () => {
    const deep: ChipColor[] = AUTO_VALUES.concat([9999]).map((value, i) => ({
      name: `C${i}`,
      swatch: '#000000',
      count: 10,
      value,
    }));

    expect(autoValued(deep).map((c) => c.value)).toEqual([...AUTO_VALUES, 9999]);
  });

  it('deals the same denominations whatever the entry', () => {
    const values = (buyIn: number) =>
      deal({ players: 6, buyIn, colors: DEFAULT_COLORS, autoValues: true }).colors.map(
        (c) => c.value,
      );

    // the prototype could hand the same case a different ladder for a different entry
    expect(values(500)).toEqual(values(2000));
    expect(values(500)).toEqual([5, 10, 25, 50, 100]);
  });
});

describe('deal — auto values', () => {
  it('deals an exact stack for the default case', () => {
    const { result } = deal({ players: 6, buyIn: 500, colors: DEFAULT_COLORS, autoValues: true });
    expect(result.ok).toBe(true);
    expect(result.val).toBe(500);
    expect(result.qty.reduce((a, b) => a + b, 0)).toBe(result.total);
  });

  it('writes the chosen denominations back into the case', () => {
    const { result, colors } = deal({
      players: 6,
      buyIn: 500,
      colors: DEFAULT_COLORS,
      autoValues: true,
    });
    result.order.forEach((ci, k) => {
      expect(colors[ci].value).toBe(result.denoms[k]);
    });
    // ordered ascending by value, so the case stays sorted after the write-back
    expect([...result.denoms]).toEqual([...result.denoms].sort((a, b) => a - b));
  });

  it('never deals more of a colour than every player can have', () => {
    const players = 6;
    const { result, colors } = deal({
      players,
      buyIn: 500,
      colors: DEFAULT_COLORS,
      autoValues: true,
    });
    result.order.forEach((ci, k) => {
      expect(result.qty[k]).toBeLessThanOrEqual(Math.floor(colors[ci].count / players));
    });
  });

  it('leaves a playable stack rather than four big chips', () => {
    const { result } = deal({ players: 5, buyIn: 2000, colors: DEFAULT_COLORS, autoValues: true });
    expect(result.total).toBeGreaterThanOrEqual(8);
  });

  it('reports a miss when the case is too thin to cover the entry', () => {
    const { result } = deal({ players: 10, buyIn: 4000, colors: caseOf(4, 4), autoValues: true });
    expect(result.ok).toBe(false);
    expect(result.val).toBeLessThan(4000);
  });
});

describe('adding a chip colour', () => {
  const withPurple: ChipColor[] = [
    ...DEFAULT_COLORS,
    { name: 'Purple', swatch: '#6b4a7a', count: 20, value: 500 },
  ];

  it('puts the new colour on the table when the entry can carry it', () => {
    const { result, colors } = deal({
      players: 6,
      buyIn: 2000,
      colors: withPurple,
      autoValues: true,
    });
    const rows = dealtRows(result, colors);
    expect(rows).toHaveLength(withPurple.length);
    expect(undealtColors(colors, rows)).toEqual([]);
  });

  it('says which colours sat out when one cannot be used', () => {
    // a 500-point chip against a 500-point entry is the whole stack in one chip
    const { result, colors } = deal({
      players: 6,
      buyIn: 500,
      colors: withPurple,
      autoValues: false,
    });
    const rows = dealtRows(result, colors);
    expect(undealtColors(colors, rows)).toEqual(['Purple']);
  });
});

describe('deal — my values', () => {
  it('uses the values the user typed', () => {
    const colors: ChipColor[] = [
      { name: 'White', swatch: '#f4f1e6', count: 120, value: 5 },
      { name: 'Red', swatch: '#ff7a63', count: 120, value: 10 },
      { name: 'Blue', swatch: '#3a4f6b', count: 120, value: 25 },
    ];
    const { result, colors: after } = deal({ players: 4, buyIn: 300, colors, autoValues: false });
    expect(result.denoms).toEqual([5, 10, 25]);
    expect(result.ok).toBe(true);
    expect(result.val).toBe(300);
    // already in fives, so the case comes back as it went in
    expect(after.map((c) => c.value)).toEqual([5, 10, 25]);
  });

  it('rounds a hand-typed value to the nearest five, in the case as well', () => {
    const colors: ChipColor[] = [
      { name: 'White', swatch: '#f4f1e6', count: 120, value: 3 },
      { name: 'Red', swatch: '#ff7a63', count: 120, value: 12 },
      { name: 'Blue', swatch: '#3a4f6b', count: 120, value: 24 },
    ];
    const { result, colors: after } = deal({ players: 4, buyIn: 300, colors, autoValues: false });

    // a chip that cannot pay a blind is the one thing the tool must not deal
    expect(after.map((c) => c.value)).toEqual([5, 10, 25]);
    expect(result.denoms).toEqual([5, 10, 25]);
  });

  it('never lets a value fall to nothing', () => {
    const colors: ChipColor[] = [
      { name: 'White', swatch: '#f4f1e6', count: 120, value: 0 },
      { name: 'Red', swatch: '#ff7a63', count: 120, value: 25 },
    ];
    const { colors: after } = deal({ players: 4, buyIn: 300, colors, autoValues: false });
    expect(after[0].value).toBe(VALUE_STEP);
  });

  it('cannot make an entry the values do not divide into', () => {
    const colors: ChipColor[] = [
      { name: 'Green', swatch: '#4a6b52', count: 40, value: 25 },
      { name: 'Black', swatch: '#1a1a1a', count: 40, value: 100 },
    ];
    const { result } = deal({ players: 4, buyIn: 310, colors, autoValues: false });
    expect(result.ok).toBe(false);
  });
});

describe('fit', () => {
  it('lands exactly when the denominations allow it', () => {
    const r = fit([1, 5, 25, 100], [40, 40, 40, 40], 500);
    expect(r.ok).toBe(true);
    expect(r.qty.reduce((s, q, i) => s + q * r.denoms[i], 0)).toBe(500);
  });

  it('respects availability', () => {
    const avail = [2, 2, 2, 2];
    const r = fit([1, 5, 25, 100], avail, 500);
    r.qty.forEach((q, i) => expect(q).toBeLessThanOrEqual(avail[i]));
  });
});

describe('exactFit', () => {
  it('declines entries outside the DP range', () => {
    expect(exactFit([1, 5], [50, 50], 0)).toBeNull();
    expect(exactFit([1, 5], [50, 50], 4001)).toBeNull();
  });

  it('breaks the fewest-chips answer down into a playable stack', () => {
    const r = exactFit([1, 5, 25, 100], [60, 60, 60, 60], 400);
    expect(r).not.toBeNull();
    expect(r!.val).toBe(400);
    expect(r!.total).toBeGreaterThanOrEqual(20);
  });

  it('returns null when no combination reaches the entry', () => {
    expect(exactFit([25, 100], [10, 10], 310)).toBeNull();
  });
});

describe('case helpers', () => {
  it('counts the chips in the case', () => {
    expect(totalChips(DEFAULT_COLORS)).toBe(200);
  });

  it('reports the points each seat could be dealt', () => {
    // 40 of each ÷ 6 players = 6 each: 6×(5+10+25+50+100)
    expect(availablePoints(DEFAULT_COLORS, 6)).toBe(6 * (5 + 10 + 25 + 50 + 100));
  });

  it('drops unused denominations from the result rows', () => {
    const { result, colors } = deal({
      players: 6,
      buyIn: 500,
      colors: DEFAULT_COLORS,
      autoValues: true,
    });
    const rows = dealtRows(result, colors);
    expect(rows.every((r) => r.qty > 0)).toBe(true);
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(result.val);
    expect(smallestDenom(rows)).toBe(Math.min(...rows.map((r) => r.value)));
  });

  it('has no rows before a deal', () => {
    expect(dealtRows(null, DEFAULT_COLORS)).toEqual([]);
  });
});
