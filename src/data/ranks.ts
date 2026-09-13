/**
 * The chip ladder — which chip a player's XP has earned them.
 *
 * New in the update-02 handoff. The five ranks, their thresholds and their colours come
 * from the prototype's `RANKS` array in
 * `docs/design-handoff-02/design/Poker Coach v3 felt.dc.html`.
 *
 * A rank is **cosmetic**: it unlocks nothing, gates nothing and is never written
 * anywhere. It is a pure read of XP, so it lives here as functions of `xp` rather than
 * as state — there is nothing to keep in sync and nothing to migrate.
 */

export type Rank = {
  name: string;
  /** XP at which this rank is reached */
  at: number;
  /** the chip's face */
  swatch: string;
  /** ink on the swatch */
  ink: string;
  /** the milled edge alternates this with the swatch */
  dash: string;
};

export const RANKS: readonly Rank[] = [
  { name: 'White chip', at: 0, swatch: '#f4f1e6', ink: '#17181a', dash: '#2b2b2b' },
  { name: 'Red chip', at: 400, swatch: '#ff7a63', ink: '#ffffff', dash: '#ffffff' },
  { name: 'Green chip', at: 1000, swatch: '#4a6b52', ink: '#ffffff', dash: '#ffffff' },
  { name: 'Blue chip', at: 2000, swatch: '#3a4f6b', ink: '#ffffff', dash: '#ffffff' },
  { name: 'Black chip', at: 4000, swatch: '#1a1a1a', ink: '#ffffff', dash: '#ffffff' },
] as const;

/**
 * The highest rank this XP has reached.
 *
 * Everyone holds the white chip, so an unhydrated or impossible total floors at 0
 * rather than reading as "no rank" — there is no such state on the ladder.
 */
export function rankIndexFor(xp: number): number {
  return RANKS.reduce((acc, rank, i) => (xp >= rank.at ? i : acc), 0);
}

export function rankFor(xp: number): Rank {
  return RANKS[rankIndexFor(xp)];
}

/** `L1`…`L5` — the label on the chip's face, from a rank's index. */
export function levelLabel(index: number): string {
  return `L${index + 1}`;
}

/** The rank above this one, or null at the top of the ladder. */
export function nextRankFrom(index: number): Rank | null {
  return RANKS[index + 1] ?? null;
}

/** XP still to earn before the next chip, or null at the top of the ladder. */
export function xpToNext(xp: number): number | null {
  const next = nextRankFrom(rankIndexFor(xp));
  return next ? next.at - xp : null;
}

/**
 * Which rank a card should wear, given the live one and the ladder's selection.
 *
 * A selection only ever looks **back**: tapping the current chip clears it, and a value
 * that is not below the live rank falls through to live rather than letting the card
 * advertise a rank the player has not earned. Home passes `null` here forever — §1.4 is
 * explicit that its card must not follow the You tab's ladder.
 */
export function shownRankIndex(liveIndex: number, viewRank: number | null): number {
  return viewRank !== null && viewRank < liveIndex ? viewRank : liveIndex;
}

/**
 * How far through the current rank, 0–100.
 *
 * Floored at 4 so a player who has just been promoted still sees a bar rather than an
 * empty track, and pinned at 100 for the last rank, which has nothing to fill towards.
 */
export function rankPct(xp: number): number {
  const index = rankIndexFor(xp);
  const next = nextRankFrom(index);
  if (!next) return 100;

  const span = next.at - RANKS[index].at;
  return Math.max(4, Math.round(((xp - RANKS[index].at) / span) * 100));
}
