/**
 * Balance maths: turning end-of-game point counts back into units.
 * Ported from the design prototype; see "Algorithms → Balance" in the handoff.
 *
 * 1 unit = 100 points, always. The rate is fixed and not user editable.
 */

export const POINTS_PER_UNIT = 100;

export type SeatBalance = {
  /** end-of-game points counted at the table */
  end: number;
  /** those points converted back at the entry rate */
  countsAs: number;
  /** countsAs − entry, in points */
  net: number;
  /** net in units */
  units: number;
};

/**
 * How much one dealt point is worth against the entry.
 * A 2,000-point entry dealt as a 1,900-point stack gives 1.053.
 */
export function pointScale(buyIn: number, dealtStack: number): number {
  return buyIn / (dealtStack || 1);
}

export function seatBalance(end: number, buyIn: number, dealtStack: number): SeatBalance {
  const countsAs = Math.round(end * pointScale(buyIn, dealtStack));
  const net = countsAs - buyIn;
  return { end, countsAs, net, units: net / POINTS_PER_UNIT };
}

export type Tally = {
  counted: number;
  dealt: number;
  /** counted − dealt; 0 when every chip is accounted for */
  off: number;
  balanced: boolean;
  message: string;
  /** total units on the table */
  unitsInPlay: number;
};

export function tally(
  ends: number[],
  buyIn: number,
  dealtStack: number,
  players: number,
): Tally {
  const counted = ends.reduce((a, b) => a + b, 0);
  const dealt = dealtStack * players;
  const off = counted - dealt;
  const message =
    off === 0
      ? 'Every chip accounted for.'
      : (off > 0
          ? `${fmt(Math.abs(off))} points over the ${fmt(dealt)} dealt`
          : `Missing ${fmt(Math.abs(off))} points against the ${fmt(dealt)} dealt`) +
        ' — recount before paying out.';

  return {
    counted,
    dealt,
    off,
    balanced: off === 0,
    message,
    unitsInPlay: (buyIn * players) / POINTS_PER_UNIT,
  };
}

/** Thousands separators, matching the prototype's `toLocaleString()`. */
export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

/** Signed points, using a real minus sign (U+2212). */
export function signedPoints(net: number): string {
  const sign = net > 0 ? '+' : net < 0 ? '−' : '';
  return sign + fmt(Math.abs(net));
}

/** Signed units to two decimals, using a real minus sign (U+2212). */
export function signedUnits(units: number): string {
  const sign = units > 0 ? '+' : units < 0 ? '−' : '';
  return `${sign}${Math.abs(units).toFixed(2)} units`;
}
