/**
 * Chip-fitting solver, ported from the design prototype
 * (docs/design-handoff/Poker Coach v3 felt.dc.html) and documented under
 * "Algorithms" in the handoff README.
 *
 * The fitting is the prototype's, unchanged. What the denominations *are* is not: the
 * prototype tried four ladders and kept whichever fitted best, and this deals one fixed
 * ladder ({@link AUTO_VALUES}) so a colour is worth the same tonight as it was last week.
 * Values set by hand follow the same rule in fives ({@link snapValue}).
 */

export type ChipColor = {
  name: string;
  swatch: string;
  /** how many of this colour the user physically owns */
  count: number;
  /** points per chip */
  value: number;
};

export type FitResult = {
  denoms: number[];
  qty: number[];
  /** points the stack actually adds up to */
  val: number;
  /** whether it hit the entry stack exactly */
  ok: boolean;
  /** chips per player */
  total: number;
  /** how many distinct denominations are in play */
  spread: number;
};

export type DealResult = {
  /** colour indices sorted ascending by value; parallel to denoms/qty */
  order: number[];
  denoms: number[];
  qty: number[];
  val: number;
  ok: boolean;
  total: number;
};

/**
 * The denominations Auto values uses, smallest first and truncated to the colour count.
 *
 * One ladder, not the prototype's four. A player who owns these chips should find the
 * same value on the same colour every night — a solver free to pick a different ladder
 * for the same case, because the entry moved by a unit, is a tool nobody can learn.
 */
export const AUTO_VALUES: readonly number[] = [5, 10, 25, 50, 100, 500, 1000, 2000, 5000];

/**
 * Values are set in fives, by hand as well as automatically: every denomination above
 * divides by five, and a blind or a bet that cannot be paid in the chips on the table is
 * the one thing a chip tool must not produce.
 */
export const VALUE_STEP = 5;

/** The nearest value a chip is allowed to carry — never nothing, always a multiple. */
export function snapValue(value: number): number {
  return Math.max(VALUE_STEP, Math.round(value / VALUE_STEP) * VALUE_STEP);
}

/**
 * The ladder laid over a case: the cheapest colour takes the first rung, the next the
 * second, and so on.
 *
 * This is what Auto values *means*, so the case carries it the moment the mode is
 * switched on rather than only after a deal. The values on the disabled fields are then
 * the values that will be dealt — the alternative is a case showing one thing and the
 * stacks another, which is the tool lying about itself.
 */
export function autoValued(colors: ChipColor[]): ChipColor[] {
  const order = colors.map((_, i) => i).sort((a, b) => colors[a].value - colors[b].value);
  const next = colors.slice();
  let moved = false;

  order.forEach((ci, k) => {
    // a case deeper than the ladder keeps what it had on the rungs past its end
    const value = AUTO_VALUES[k] ?? colors[ci].value;
    if (value === colors[ci].value) return;
    next[ci] = { ...colors[ci], value };
    moved = true;
  });

  // a case already on the ladder comes back as itself, so nothing downstream reads an
  // identity change as an edit
  return moved ? next : colors;
}

/** Chips per player below which a stack is considered unplayable, so the
 *  exact-fit result gets broken down into smaller denominations. */
const PLAYABLE_STACK = 20;

/**
 * Bounded DP over the denominations: finds an exact stack when the greedy pass
 * misses, then breaks the big chips down until the stack is playable.
 * Only attempted for entries in 1..4000 points to keep the table small.
 */
export function exactFit(
  denoms: number[],
  avail: number[],
  buyIn: number,
): FitResult | null {
  const n = denoms.length;
  if (buyIn < 1 || buyIn > 4000) return null;

  const dp: Uint8Array[] = [new Uint8Array(buyIn + 1)];
  const cnt: (Int32Array | null)[] = [null];
  dp[0][0] = 1;

  for (let i = 0; i < n; i++) {
    const row = new Uint8Array(buyIn + 1);
    const cs = new Int32Array(buyIn + 1).fill(-1);
    const d = denoms[i];
    const cap = avail[i];
    for (let sum = 0; sum <= buyIn; sum++) {
      if (sum >= d && row[sum - d] && cs[sum - d] < cap) {
        row[sum] = 1;
        cs[sum] = cs[sum - d] + 1;
      } else if (dp[i][sum]) {
        row[sum] = 1;
        cs[sum] = 0;
      }
    }
    dp.push(row);
    cnt.push(cs);
  }

  if (!dp[n][buyIn]) return null;

  const qty = new Array<number>(n).fill(0);
  let sum = buyIn;
  for (let i = n - 1; i >= 0; i--) {
    qty[i] = cnt[i + 1]![sum];
    sum -= qty[i] * denoms[i];
  }

  // The DP lands on the fewest, largest chips. Break big chips down into
  // smaller ones (exact value, within availability) until the stack is playable.
  let guard = 0;
  while (qty.reduce((a, b) => a + b, 0) < PLAYABLE_STACK && guard++ < 300) {
    let swapped = false;
    for (let i = n - 1; i >= 1 && !swapped; i--) {
      if (qty[i] <= 0) continue;
      let rem = denoms[i];
      const add = new Array<number>(n).fill(0);
      for (let j = i - 1; j >= 0; j--) {
        const k = Math.min(avail[j] - qty[j], Math.floor(rem / denoms[j]));
        if (k > 0) {
          add[j] = k;
          rem -= k * denoms[j];
        }
      }
      if (rem === 0 && add.reduce((a, b) => a + b, 0) > 1) {
        qty[i]--;
        for (let j = 0; j < n; j++) qty[j] += add[j];
        swapped = true;
      }
    }
    if (!swapped) break;
  }

  const total = qty.reduce((a, b) => a + b, 0);
  return { denoms, qty, val: buyIn, ok: true, total, spread: qty.filter((q) => q > 0).length };
}

/**
 * Fits a stack to the entry, preferring one that uses every colour in the case.
 */
export function fit(denoms: number[], avail: number[], buyIn: number): FitResult {
  const first = greedyFit(denoms, avail, buyIn);
  if (first.ok && first.spread === denoms.length) return first;

  // A colour of the case went unused. Try again with one of every denomination
  // reserved up front, so a case that *can* put every colour on the table does.
  const spread = reservedFit(denoms, avail, buyIn);
  if (spread && (!first.ok || spread.spread > first.spread)) return spread;
  return first;
}

/**
 * Reserves one of every denomination, fits the remainder, then adds the
 * reserved chips back. Returns null when the reserve alone overshoots the
 * entry — a chip worth more than the stack genuinely cannot be dealt.
 */
function reservedFit(denoms: number[], avail: number[], buyIn: number): FitResult | null {
  if (avail.some((a) => a < 1)) return null;
  const reserved = denoms.reduce((a, b) => a + b, 0);
  if (reserved > buyIn) return null;

  const rest = greedyFit(
    denoms,
    avail.map((a) => a - 1),
    buyIn - reserved,
  );
  if (!rest.ok) return null;

  const qty = rest.qty.map((q) => q + 1);
  const total = qty.reduce((a, b) => a + b, 0);
  return { denoms, qty, val: buyIn, ok: true, total, spread: qty.filter((q) => q > 0).length };
}

/**
 * Greedy seed + repair: a weighted spread that leans on the larger chips, then
 * chips added or removed one at a time until the stack matches the entry.
 * Falls back to {@link exactFit} when the repair can't land exactly.
 */
function greedyFit(denoms: number[], avail: number[], buyIn: number): FitResult {
  const n = denoms.length;
  const wsum = (n * (n + 1)) / 2;
  const qty = denoms.map((d, i) =>
    Math.min(
      avail[i],
      Math.max(i === 0 ? 4 : 0, Math.round(((i + 1) / wsum) * buyIn / d)),
    ),
  );

  let val = qty.reduce((s, c, i) => s + c * denoms[i], 0);
  let guard = 0;
  while (val !== buyIn && guard++ < 5000) {
    if (val < buyIn) {
      let k = -1;
      for (let i = n - 1; i >= 0; i--) {
        if (denoms[i] <= buyIn - val && qty[i] < avail[i]) {
          k = i;
          break;
        }
      }
      if (k < 0) break;
      qty[k]++;
      val += denoms[k];
    } else {
      let k = -1;
      for (let i = n - 1; i >= 0; i--) {
        if (qty[i] > 0 && denoms[i] <= val - buyIn) {
          k = i;
          break;
        }
      }
      if (k < 0) {
        for (let i = 0; i < n; i++) {
          if (qty[i] > 0) {
            k = i;
            break;
          }
        }
      }
      if (k < 0) break;
      qty[k]--;
      val -= denoms[k];
    }
  }

  if (val !== buyIn) {
    const ex = exactFit(denoms, avail, buyIn);
    if (ex) return ex;
  }

  const total = qty.reduce((a, b) => a + b, 0);
  return { denoms, qty, val, ok: val === buyIn, total, spread: qty.filter((q) => q > 0).length };
}

export type DealInput = {
  players: number;
  /** entry in points (units × 100) */
  buyIn: number;
  colors: ChipColor[];
  autoValues: boolean;
};

export type Deal = {
  result: DealResult;
  /** In Auto mode the chosen denominations are written back into the case. */
  colors: ChipColor[];
};

/**
 * Deals an equal stack to every player.
 *
 * Auto mode assigns {@link AUTO_VALUES} in order, smallest colour first. My values uses
 * what the player typed, snapped to {@link VALUE_STEP} — which is also what goes back
 * into the case, so the values on screen are the values that were dealt.
 */
export function deal({ players, buyIn, colors, autoValues }: DealInput): Deal {
  // Snapping cannot reorder anything: rounding to the nearest five is monotonic, so a
  // case sorted by value stays sorted.
  const cased = autoValues ? colors : colors.map((c) => ({ ...c, value: snapValue(c.value) }));
  const order = cased.map((_, i) => i).sort((a, b) => cased[a].value - cased[b].value);
  const avail = order.map((i) => Math.floor(cased[i].count / players));
  const n = cased.length;

  const pick: FitResult = autoValues
    ? fit(AUTO_VALUES.slice(0, n) as number[], avail, buyIn)
    : fit(
        order.map((i) => cased[i].value),
        avail,
        buyIn,
      );

  const nextColors = autoValues
    ? cased.map((c, i) => {
        const k = order.indexOf(i);
        return k < 0 ? c : { ...c, value: pick.denoms[k] };
      })
    : cased;

  return {
    result: {
      order,
      denoms: pick.denoms,
      qty: pick.qty,
      val: pick.val,
      ok: pick.ok,
      total: pick.total,
    },
    colors: nextColors,
  };
}

/** Rows of the result card / Balance stacks: one per dealt denomination. */
export type DealtRow = {
  colorIndex: number;
  name: string;
  swatch: string;
  value: number;
  qty: number;
  total: number;
};

export function dealtRows(result: DealResult | null, colors: ChipColor[]): DealtRow[] {
  if (!result) return [];
  return result.order
    .map((ci, k) => ({
      colorIndex: ci,
      name: colors[ci].name,
      swatch: colors[ci].swatch,
      value: result.denoms[k],
      qty: result.qty[k],
      total: result.denoms[k] * result.qty[k],
    }))
    .filter((r) => r.qty > 0);
}

/**
 * Colours the deal left out of the stack entirely — a chip worth more than the
 * whole stack, or one the entry simply has no room for.
 */
export function undealtColors(colors: ChipColor[], rows: DealtRow[]): string[] {
  const dealt = new Set(rows.map((r) => r.colorIndex));
  return colors.filter((_, i) => !dealt.has(i)).map((c) => c.name);
}

/** Points every seat can be dealt out of the case, at this player count. */
export function availablePoints(colors: ChipColor[], players: number): number {
  return colors.reduce((a, c) => a + Math.floor(c.count / players) * c.value, 0);
}

export function totalChips(colors: ChipColor[]): number {
  return colors.reduce((a, c) => a + c.count, 0);
}

/** The blinds suggestion is suppressed when the smallest chip is a big bite
 *  out of the stack — more than this share of the entry. */
export const COARSE_CHIP_SHARE = 0.05;

export function smallestDenom(rows: DealtRow[]): number {
  return rows.length ? Math.min(...rows.map((r) => r.value)) : 1;
}
