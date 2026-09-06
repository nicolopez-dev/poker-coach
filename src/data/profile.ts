/**
 * What is left of the handoff's sample data.
 *
 * The name, the avatar, the streak, the XP, the accuracy, the week chart and the daily
 * goal are all real now — they come from `get_state()` through the store. Two things
 * are not, and both are marked as such rather than quietly passing for data:
 *
 *   · `COACH_NOTE` — **authored copy with nothing behind it.** There is no model that
 *     reads a player's answers and notices they fold too much from the button, and
 *     assembling one out of the numbers we do have would be inventing an insight. It
 *     stays as writing until something can actually say it.
 *   · `GAMES` — sample games, until P19 records real ones.
 */

/** Sample. Replaced in P19, when dealing a stack starts writing a `games` row. */
export type Game = {
  date: string;
  detail: string;
  /** balance in units */
  net: number;
  /** what "Reuse" loads back into the chip tool */
  players: number;
  /** entry in points */
  buyIn: number;
};

export const GAMES: Game[] = [
  {
    date: 'Fri 21 Aug',
    detail: '6 players · 20 units in · 1,900 pts dealt',
    net: 2.0,
    players: 6,
    buyIn: 2000,
  },
  {
    date: 'Sat 15 Aug',
    detail: '5 players · 10 units in · 1,000 pts dealt',
    net: -0.6,
    players: 5,
    buyIn: 1000,
  },
  {
    date: 'Fri 8 Aug',
    detail: '8 players · 30 units in · 2,940 pts dealt',
    net: 3.2,
    players: 8,
    buyIn: 3000,
  },
];

/**
 * **Authored copy, not a finding.** Shown as the coach's note on Home; nothing computes
 * it, and nothing should pretend to until the app can genuinely read a habit out of a
 * player's answers.
 */
export const COACH_NOTE = {
  title: 'You fold too much from the button.',
  body: "Last seat to act, best seat at the table. Tomorrow's drill is all yours.",
};
