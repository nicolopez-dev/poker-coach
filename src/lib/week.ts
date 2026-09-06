/**
 * The week chart's shape.
 *
 * The handoff draws seven bars with the tallest at 74pt, so the chart is relative to the
 * player's own best day rather than to some absolute idea of a lot of poker. Kept pure
 * and here rather than in the screen because 74 is a design value that would otherwise
 * drift the first time somebody nudges the layout.
 */

/** The tallest bar, in points — `docs/design-handoff/README.md`. */
export const WEEK_BAR_MAX = 74;

/**
 * What a day with nothing on it still draws. A zero-height bar reads as a broken chart;
 * a thin one reads as a quiet day, which is what it is.
 */
export const WEEK_BAR_EMPTY = 4;

/**
 * Bar heights for a week of counts, scaled so the busiest day is `WEEK_BAR_MAX`.
 *
 * A week with nothing in it is not an error: every bar sits at the baseline, and the
 * chart keeps its seven columns rather than collapsing.
 */
export function barHeights(counts: number[]): number[] {
  const tallest = Math.max(0, ...counts);
  if (tallest === 0) return counts.map(() => WEEK_BAR_EMPTY);

  return counts.map((n) =>
    n === 0 ? WEEK_BAR_EMPTY : Math.max(WEEK_BAR_EMPTY, Math.round((n / tallest) * WEEK_BAR_MAX)),
  );
}

/** Sunday-first, because that is what `getUTCDay` counts from. */
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The single letter under a bar, from a `YYYY-MM-DD` local day.
 *
 * Read at midday UTC and in UTC: the string is already the player's *local* day, worked
 * out by the server from the offset they sent, so shifting it by a timezone again would
 * name the wrong weekday either side of midnight.
 */
export function dayLetter(day: string): string {
  return LETTERS[new Date(`${day}T12:00:00.000Z`).getUTCDay()] ?? '';
}
