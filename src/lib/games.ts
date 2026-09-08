/**
 * The two lines a game shows in "Your games".
 *
 * Both are built from the stored values rather than written down anywhere — the row that
 * used to read "Fri 21 Aug · 6 players · 20 units in · 1,900 pts dealt" was sample copy,
 * and this is the same sentence assembled from what the server actually holds. Kept here,
 * and tested, because a detail line built inline in a screen is a format nobody notices
 * drifting.
 */

import { fmt, POINTS_PER_UNIT } from './balance';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * "Fri 21 Aug" — the handoff's own format, in the device's time zone, which is the
 * evening the player actually had. A date we cannot read says nothing rather than
 * "Invalid Date".
 */
export function gameDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${DAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/**
 * "6 players · 20 units in · 1,900 pts dealt · 5 colours".
 *
 * The colours are the case the game was played with, and a game recorded before games
 * kept one simply ends a segment earlier rather than claiming a number it does not have.
 */
export function gameDetail(game: {
  players: number;
  buyIn: number;
  dealtStack: number;
  colors?: unknown[] | null;
}): string {
  const units = Math.round(game.buyIn / POINTS_PER_UNIT);
  const line = `${game.players} players · ${units} units in · ${fmt(game.dealtStack)} pts dealt`;
  if (!game.colors) return line;

  const count = game.colors.length;
  return `${line} · ${count} ${count === 1 ? 'colour' : 'colours'}`;
}
