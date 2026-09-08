/**
 * The chip ladder, pinned at its edges.
 *
 * A rank is cosmetic, but it is the one number on the You tab a player can check
 * against their own XP — so getting the boundary wrong would be visible and would look
 * like the app had lost track of them.
 */
import {
  RANKS,
  levelLabel,
  nextRankFrom,
  rankFor,
  rankIndexFor,
  rankPct,
  shownRankIndex,
  xpToNext,
} from './ranks';

describe('the ladder itself', () => {
  it('is five chips', () => {
    expect(RANKS).toHaveLength(5);
  });

  it('starts at zero, so everyone holds a chip', () => {
    expect(RANKS[0].at).toBe(0);
  });

  it('climbs — every rank costs more than the one below it', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(`${RANKS[i].name} ${RANKS[i].at > RANKS[i - 1].at}`).toBe(`${RANKS[i].name} true`);
    }
  });
});

describe('the rank an XP total has reached', () => {
  it('gives the white chip to a player who has never answered', () => {
    expect(rankFor(0).name).toBe('White chip');
  });

  it('promotes on the threshold, not after it', () => {
    expect(rankFor(399).name).toBe('White chip');
    expect(rankFor(400).name).toBe('Red chip');
    expect(rankFor(999).name).toBe('Red chip');
    expect(rankFor(1000).name).toBe('Green chip');
  });

  it('stays on the top chip however far past it a player gets', () => {
    expect(rankFor(4000).name).toBe('Black chip');
    expect(rankFor(400000).name).toBe('Black chip');
    expect(rankIndexFor(400000)).toBe(RANKS.length - 1);
  });

  it('floors at the white chip rather than inventing a rank below it', () => {
    expect(rankIndexFor(-1)).toBe(0);
  });
});

describe('the label on the chip face', () => {
  it('counts from one, not from zero', () => {
    expect(levelLabel(0)).toBe('L1');
    expect(levelLabel(4)).toBe('L5');
  });
});

describe('what is left to climb', () => {
  it('counts down to the next chip', () => {
    expect(xpToNext(0)).toBe(400);
    expect(xpToNext(399)).toBe(1);
    expect(xpToNext(400)).toBe(600);
  });

  it('has nothing to count at the top of the ladder', () => {
    expect(xpToNext(4000)).toBeNull();
    expect(nextRankFrom(RANKS.length - 1)).toBeNull();
  });
});

describe('what the rank card is showing', () => {
  it('shows the live rank when nothing is selected', () => {
    expect(shownRankIndex(2, null)).toBe(2);
  });

  it('follows a selection down the ladder', () => {
    expect(shownRankIndex(3, 1)).toBe(1);
  });

  it('treats picking the current chip as going back to live', () => {
    expect(shownRankIndex(2, 2)).toBe(2);
  });

  it('refuses to advertise a rank the player has not earned', () => {
    expect(shownRankIndex(1, 4)).toBe(1);
  });

  it('stays live for Home, which never selects', () => {
    for (const live of [0, 1, 2, 3, 4]) {
      expect(shownRankIndex(live, null)).toBe(live);
    }
  });
});

describe('the progress bar', () => {
  it('reads the share of the way to the next chip', () => {
    // half of the 400 → 1000 span
    expect(rankPct(700)).toBe(50);
  });

  it('shows a sliver on promotion rather than an empty track', () => {
    expect(rankPct(400)).toBe(4);
    expect(rankPct(0)).toBe(4);
  });

  it('is full at the top, where there is nothing left to fill towards', () => {
    expect(rankPct(4000)).toBe(100);
    expect(rankPct(99999)).toBe(100);
  });

  it('never runs past full', () => {
    for (const xp of [0, 1, 399, 400, 999, 1000, 1999, 2000, 3999, 4000, 100000]) {
      const pct = rankPct(xp);
      expect(`${xp} → ${pct >= 4 && pct <= 100}`).toBe(`${xp} → true`);
    }
  });
});
