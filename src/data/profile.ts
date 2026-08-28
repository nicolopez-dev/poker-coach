/**
 * Sample profile data. Nothing here is persisted or written by the app yet —
 * see "Open items" in docs/design-handoff/README.md.
 */
import { colors } from '../theme/tokens';

export const PROFILE = {
  initials: 'MR',
  name: 'Marta R.',
  subtitle: 'Level 4 · Friday-night regular',
  gamesTotal: 11,
} as const;

export const HOME_STATS = [
  { value: '78%', label: 'Sharp' },
  { value: '42', label: 'Drills' },
  { value: '7', label: 'Streak' },
  { value: 'L4', label: 'Level' },
];

/** Bar heights in points, tallest 74. */
export const WEEK = [
  { label: 'M', height: 46, fill: colors.text },
  { label: 'T', height: 62, fill: colors.text },
  { label: 'W', height: 30, fill: colors.text },
  { label: 'T', height: 70, fill: colors.text },
  { label: 'F', height: 54, fill: colors.text },
  { label: 'S', height: 18, fill: colors.greenSpent },
  { label: 'S', height: 26, fill: colors.red },
];

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

export const COACH_NOTE = {
  title: 'You fold too much from the button.',
  body: "Last seat to act, best seat at the table. Tomorrow's drill is all yours.",
};

export const DAILY_GOAL = {
  title: 'Three more drills and the streak is yours',
  pct: 40,
  label: '2 of 5 drills',
};
