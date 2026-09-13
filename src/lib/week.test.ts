import { WEEK_BAR_EMPTY, WEEK_BAR_MAX, barHeights, dayFace, dayLetter } from './week';

describe('barHeights', () => {
  it('puts the busiest day at the handoff’s 74pt', () => {
    const heights = barHeights([2, 8, 0, 5, 1, 0, 3]);
    expect(Math.max(...heights)).toBe(WEEK_BAR_MAX);
    expect(heights[1]).toBe(WEEK_BAR_MAX);
  });

  it('scales the rest against it', () => {
    expect(barHeights([5, 10])).toEqual([37, 74]);
  });

  it('draws a quiet day rather than nothing at all', () => {
    const heights = barHeights([0, 10, 0]);
    expect(heights[0]).toBe(WEEK_BAR_EMPTY);
    expect(heights[2]).toBe(WEEK_BAR_EMPTY);
  });

  it('keeps its shape on a week with nothing in it', () => {
    expect(barHeights([0, 0, 0, 0, 0, 0, 0])).toEqual(new Array(7).fill(WEEK_BAR_EMPTY));
  });

  it('never rounds a day that was played down to the baseline', () => {
    // one answer against a hundred is still a day the player turned up
    expect(barHeights([1, 100])[0]).toBe(WEEK_BAR_EMPTY);
    expect(barHeights([1, 100])[0]).toBeGreaterThan(0);
  });

  it('gives every day the full height when they are all equal', () => {
    expect(barHeights([4, 4, 4])).toEqual([74, 74, 74]);
  });
});

describe('dayLetter', () => {
  it('names the weekday of the local day it is given', () => {
    // 2026-09-06 is a Sunday, and the days before it run backwards from there
    expect(dayLetter('2026-09-06')).toBe('S');
    expect(dayLetter('2026-09-05')).toBe('S'); // Saturday
    expect(dayLetter('2026-09-04')).toBe('F');
    expect(dayLetter('2026-09-02')).toBe('W');
    expect(dayLetter('2026-08-31')).toBe('M');
  });
});

describe("a day's card face", () => {
  it('gives the same day the same card every time', () => {
    expect(dayFace('2026-09-08')).toEqual(dayFace('2026-09-08'));
  });

  it('gives different days different cards, mostly', () => {
    const week = ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];
    const faces = week.map((d) => `${dayFace(d).rank}${dayFace(d).suit}`);
    // a hash, not a shuffle — but a whole week landing on one card would be a bug
    expect(new Set(faces).size).toBeGreaterThan(1);
  });

  it('only ever deals a real card', () => {
    const ranks = new Set(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
    const suits = new Set(['♠', '♥', '♦', '♣']);
    for (let d = 1; d <= 28; d++) {
      const face = dayFace(`2026-02-${String(d).padStart(2, '0')}`);
      expect(`${face.rank} ${ranks.has(face.rank)}`).toBe(`${face.rank} true`);
      expect(`${face.suit} ${suits.has(face.suit)}`).toBe(`${face.suit} true`);
    }
  });
});
