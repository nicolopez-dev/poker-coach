/**
 * Chip-fitting solver, ported from the design prototype
 * (docs/design-handoff/Poker Coach v3 felt.dc.html) and documented under
 * "Algorithms" in the handoff README. Behaviour is deliberately identical.
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

/** Denomination ladders tried in Auto mode, truncated to the colour count. */
export const LADDERS: readonly (readonly number[])[] = [
  [1, 2, 5, 10, 25, 50, 100, 250],
  [1, 5, 10, 25, 50, 100, 500, 1000],
  [5, 10, 25, 50, 100, 500, 1000, 2500],
  [1, 2, 5, 20, 50, 100, 200, 500],
];

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

/** Chips per player the Auto picker aims for when everything else ties. */
const IDEAL_STACK = 24;

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
 * In Auto mode each ladder is tried and the friendliest fit wins: exact fits
 * with at least 8 chips first, then more distinct denominations, then a total
 * nearest {@link IDEAL_STACK}, then the smallest error.
 */
export function deal({ players, buyIn, colors, autoValues }: DealInput): Deal {
  const order = colors.map((_, i) => i).sort((a, b) => colors[a].value - colors[b].value);
  const avail = order.map((i) => Math.floor(colors[i].count / players));
  const n = colors.length;

  let pick: FitResult;
  if (autoValues) {
    const cands = LADDERS.map((l) => fit(l.slice(0, n) as number[], avail, buyIn));
    const ok = cands.filter((c) => c.ok && c.total >= 8);
    const pool = ok.length ? ok : cands.filter((c) => c.ok);
    pick = (pool.length ? pool : cands).sort(
      (a, b) =>
        b.spread - a.spread ||
        Math.abs(a.total - IDEAL_STACK) - Math.abs(b.total - IDEAL_STACK) ||
        Math.abs(a.val - buyIn) - Math.abs(b.val - buyIn),
    )[0];
  } else {
    pick = fit(
      order.map((i) => colors[i].value),
      avail,
      buyIn,
    );
  }

  const nextColors = autoValues
    ? colors.map((c, i) => {
        const k = order.indexOf(i);
        return k < 0 ? c : { ...c, value: pick.denoms[k] };
      })
    : colors;

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
