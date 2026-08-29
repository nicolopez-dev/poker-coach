/**
 * Hold'em maths, by enumeration.
 *
 * Lessons quote probabilities and equities, and those numbers are the reason
 * anyone trusts the app. Nothing in here is a remembered figure: every value
 * the course cites is recomputed from a full deck and pinned by holdem.test.ts,
 * so a wrong number in a lesson fails the build rather than shipping.
 *
 * Cards are packed into 0..51 — `c >> 2` is the rank index, `c & 3` the suit.
 */
import type { FaceCard, Suit } from '../content/types';

/** Rank characters, lowest first. Content writes a ten as '10'. */
export const RANKS = '23456789TJQKA';
export const SUITS: readonly Suit[] = ['♠', '♥', '♦', '♣'];

export type Card = number;

/** 2..14, so an ace is 14. */
export const rankOf = (c: Card): number => (c >> 2) + 2;
export const suitOf = (c: Card): number => c & 3;

export function cardId(rank: string, suit: Suit): Card {
  const r = RANKS.indexOf(rank === '10' ? 'T' : rank);
  const s = SUITS.indexOf(suit);
  if (r < 0 || s < 0) throw new Error(`not a card: ${rank}${suit}`);
  return r * 4 + s;
}

/** A card from a question's fan. */
export const toCard = (c: FaceCard): Card => cardId(c.rank, c.suit);

const SHORTHAND: Record<string, Suit> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/** `'As Kh 9d'` — the shorthand the tests are written in. */
export function cards(text: string): Card[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const suit = SHORTHAND[token.slice(-1)];
      if (!suit) throw new Error(`not a card: ${token}`);
      return cardId(token.slice(0, -1), suit);
    });
}

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

export const deckWithout = (dead: readonly Card[]): Card[] => {
  const gone = new Set(dead);
  return fullDeck().filter((c) => !gone.has(c));
};

/* ------------------------------------------------------------------ *
 * Hand strength
 * ------------------------------------------------------------------ */

export const CATEGORY = {
  highCard: 0,
  pair: 1,
  twoPair: 2,
  trips: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  quads: 7,
  straightFlush: 8,
} as const;

/** Highest card of the best straight in a rank bitmask, or 0 for none. */
function straightHigh(rankMask: number): number {
  // the wheel: an ace also plays below the two
  const mask = rankMask & (1 << 14) ? rankMask | (1 << 1) : rankMask;
  for (let high = 14; high >= 5; high--) {
    const run =
      (1 << high) | (1 << (high - 1)) | (1 << (high - 2)) | (1 << (high - 3)) | (1 << (high - 4));
    if ((mask & run) === run) return high;
  }
  return 0;
}

/** category first, then up to five kickers, base 16 */
function score(category: number, kickers: readonly number[]): number {
  let packed = category;
  for (let i = 0; i < 5; i++) packed = packed * 16 + (kickers[i] ?? 0);
  return packed;
}

/**
 * Rank a five- to seven-card hand. Higher is better, and equal scores are a
 * genuine tie — which is what makes split pots come out right.
 */
export function evaluate(hand: readonly Card[]): number {
  const byRank = new Array<number>(15).fill(0);
  const bySuit = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  let rankMask = 0;

  for (const c of hand) {
    const r = rankOf(c);
    const s = suitOf(c);
    byRank[r]++;
    bySuit[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (bySuit[s] >= 5) flushSuit = s;

  if (flushSuit >= 0) {
    const high = straightHigh(suitMask[flushSuit]);
    if (high) return score(CATEGORY.straightFlush, [high]);
  }

  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const descending: number[] = [];
  for (let r = 14; r >= 2; r--) {
    if (byRank[r] === 4) quads.push(r);
    else if (byRank[r] === 3) trips.push(r);
    else if (byRank[r] === 2) pairs.push(r);
    for (let i = 0; i < byRank[r]; i++) descending.push(r);
  }

  if (quads.length) {
    const kicker = descending.find((r) => r !== quads[0]) ?? 0;
    return score(CATEGORY.quads, [quads[0], kicker]);
  }
  if (trips.length >= 2) return score(CATEGORY.fullHouse, [trips[0], trips[1]]);
  if (trips.length === 1 && pairs.length) return score(CATEGORY.fullHouse, [trips[0], pairs[0]]);

  if (flushSuit >= 0) {
    const suited: number[] = [];
    for (let r = 14; r >= 2 && suited.length < 5; r--) if (suitMask[flushSuit] & (1 << r)) suited.push(r);
    return score(CATEGORY.flush, suited);
  }

  const high = straightHigh(rankMask);
  if (high) return score(CATEGORY.straight, [high]);

  if (trips.length === 1) {
    const kickers = descending.filter((r) => r !== trips[0]);
    return score(CATEGORY.trips, [trips[0], kickers[0], kickers[1]]);
  }
  if (pairs.length >= 2) {
    const kickers = descending.filter((r) => r !== pairs[0] && r !== pairs[1]);
    return score(CATEGORY.twoPair, [pairs[0], pairs[1], kickers[0]]);
  }
  if (pairs.length === 1) {
    const kickers = descending.filter((r) => r !== pairs[0]);
    return score(CATEGORY.pair, [pairs[0], kickers[0], kickers[1], kickers[2]]);
  }
  return score(CATEGORY.highCard, descending.slice(0, 5));
}

/** The category of a scored hand, for readable assertions. */
export const categoryOf = (scored: number): number => Math.floor(scored / 16 ** 5);

/* ------------------------------------------------------------------ *
 * Enumeration
 * ------------------------------------------------------------------ */

/** Every way to choose `k` of `pool`, handed to `visit` in a reused buffer. */
export function combinations(pool: readonly Card[], k: number, visit: (chosen: Card[]) => void): void {
  const chosen = new Array<Card>(k);
  const walk = (start: number, depth: number): void => {
    if (depth === k) {
      visit(chosen);
      return;
    }
    for (let i = start; i <= pool.length - (k - depth); i++) {
      chosen[depth] = pool[i];
      walk(i + 1, depth + 1);
    }
  };
  if (k === 0) visit(chosen);
  else walk(0, 0);
}

export function countCombinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let total = 1;
  for (let i = 0; i < k; i++) total = (total * (n - i)) / (i + 1);
  return Math.round(total);
}

export type Equity = {
  win: number;
  lose: number;
  tie: number;
  /** ties counted at half, the way an all-in actually pays out */
  equity: number;
  boards: number;
};

/**
 * Exact head-to-head equity, by running every board that can still come.
 * Preflop that is all 1,712,304 of them — slow, and worth it.
 */
export function equity(
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[] = [],
): Equity {
  const deck = deckWithout([...hero, ...villain, ...board]);
  const heroHand = [...hero, ...board, 0, 0, 0, 0, 0].slice(0, 7);
  const villainHand = [...villain, ...board, 0, 0, 0, 0, 0].slice(0, 7);
  const known = 2 + board.length;
  const toCome = 5 - board.length;

  let win = 0;
  let lose = 0;
  let tie = 0;
  combinations(deck, toCome, (runout) => {
    for (let i = 0; i < toCome; i++) {
      heroHand[known + i] = runout[i];
      villainHand[known + i] = runout[i];
    }
    const a = evaluate(heroHand);
    const b = evaluate(villainHand);
    if (a > b) win++;
    else if (a < b) lose++;
    else tie++;
  });

  const boards = win + lose + tie;
  return { win: win / boards, lose: lose / boards, tie: tie / boards, equity: (win + tie / 2) / boards, boards };
}

/**
 * The best hand any two unseen cards could make on this board, and one holding
 * that makes it. "Is my big hand actually the nuts?" is a question lessons ask
 * constantly, and this is how the answer gets checked rather than assumed.
 */
export function nutHand(board: readonly Card[], dead: readonly Card[] = []): {
  score: number;
  category: number;
  hole: [Card, Card];
} {
  let score = -1;
  let hole: [Card, Card] = [0, 0];
  combinations(deckWithout([...board, ...dead]), 2, (candidate) => {
    const value = evaluate([...candidate, ...board]);
    if (value > score) {
      score = value;
      hole = [candidate[0], candidate[1]];
    }
  });
  return { score, category: categoryOf(score), hole };
}

/** Whether any two unseen cards already make a straight on this board. */
export function straightPossible(board: readonly Card[]): boolean {
  let found = false;
  combinations(deckWithout(board), 2, (hole) => {
    if (!found && categoryOf(evaluate([...hole, ...board])) === CATEGORY.straight) found = true;
  });
  return found;
}

/** Fraction of the flops behind `dead` that satisfy `hits`. */
export function flopChance(dead: readonly Card[], hits: (flop: readonly Card[]) => boolean): number {
  const deck = deckWithout(dead);
  let good = 0;
  let total = 0;
  combinations(deck, 3, (flop) => {
    total++;
    if (hits(flop)) good++;
  });
  return good / total;
}

/* ------------------------------------------------------------------ *
 * Starting-hand ranges
 * ------------------------------------------------------------------ */

/**
 * Expand standard range notation into the actual two-card combos.
 *
 * `'22+'` every pair, `'ATs+'` suited ace-ten and better, `'AJo+'` offsuit,
 * `'AK'` both, `'K5s+'` king-five through king-queen suited. A dash gives a
 * span — `'22-JJ'`, `'A2s-AJs'` — which is how a capped range gets written:
 * everything up to a point, because the hands above it would have raised.
 * Comma-separated, and overlapping pieces are counted once.
 *
 * Lessons quote how wide a seat opens; this is what turns a chart into a
 * number instead of a claim.
 */
export function rangeCombos(notation: string): [Card, Card][] {
  const found = new Map<number, [Card, Card]>();

  const add = (hi: number, lo: number, mode: 's' | 'o' | 'b'): void => {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (hi === lo && s1 >= s2) continue; // a pair is unordered
        if (hi !== lo) {
          const isSuited = s1 === s2;
          if (mode === 's' && !isSuited) continue;
          if (mode === 'o' && isSuited) continue;
        }
        const a = hi * 4 + s1;
        const b = lo * 4 + s2;
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        found.set(low * 52 + high, [low, high]);
      }
    }
  };

  /** 'AJs' -> { hi, lo, mode }, the shape both a plain token and a span end use. */
  const parseHand = (text: string): { hi: number; lo: number; mode: 's' | 'o' | 'b' } => {
    const tail = text[text.length - 1];
    const mode: 's' | 'o' | 'b' = tail === 's' ? 's' : tail === 'o' ? 'o' : 'b';
    const faces = mode === 'b' ? text : text.slice(0, -1);
    const first = RANKS.indexOf(faces[0]);
    const second = RANKS.indexOf(faces[1]);
    if (faces.length !== 2 || first < 0 || second < 0) throw new Error(`not a range: ${text}`);
    return { hi: Math.max(first, second), lo: Math.min(first, second), mode };
  };

  for (const raw of notation.replace(/10/g, 'T').split(',')) {
    const token = raw.trim();
    if (!token) continue;

    // a span: '22-JJ', 'A2s-AJs'
    if (token.includes('-')) {
      const [fromText, toText] = token.split('-').map((s) => s.trim());
      const from = parseHand(fromText);
      const to = parseHand(toText);
      if (from.mode !== to.mode) throw new Error(`mixed span: ${token}`);
      if (from.hi === from.lo && to.hi === to.lo) {
        // a run of pairs, either way round
        for (let r = Math.min(from.hi, to.hi); r <= Math.max(from.hi, to.hi); r++) add(r, r, 'b');
      } else {
        if (from.hi !== to.hi) throw new Error(`span must share its top card: ${token}`);
        for (let r = Math.min(from.lo, to.lo); r <= Math.max(from.lo, to.lo); r++) {
          add(from.hi, r, from.mode);
        }
      }
      continue;
    }

    const plus = token.endsWith('+');
    const body = plus ? token.slice(0, -1) : token;
    const tail = body[body.length - 1];
    const mode: 's' | 'o' | 'b' = tail === 's' ? 's' : tail === 'o' ? 'o' : 'b';
    const faces = mode === 'b' ? body : body.slice(0, -1);

    const first = RANKS.indexOf(faces[0]);
    const second = RANKS.indexOf(faces[1]);
    if (faces.length !== 2 || first < 0 || second < 0) throw new Error(`not a range: ${token}`);

    const hi = Math.max(first, second);
    const lo = Math.min(first, second);

    if (hi === lo) {
      // '22+' walks the pairs up to aces
      for (let r = hi; r <= (plus ? RANKS.length - 1 : hi); r++) add(r, r, 'b');
    } else {
      // 'K5s+' walks the kicker up to one below the top card
      for (let r = lo; r <= (plus ? hi - 1 : lo); r++) add(hi, r, mode);
    }
  }

  return [...found.values()];
}

/** How many of the 1,326 combos a range holds. */
export const rangeSize = (notation: string): number => rangeCombos(notation).length;

/** The lowest score in a category — `evaluate(...) >= atLeast(CATEGORY.twoPair)`. */
export const atLeast = (category: number): number => category * 16 ** 5;

/**
 * What share of a range reaches `threshold` on this board, once the combos
 * that clash with the board are removed.
 *
 * This is how "the flop favours your range" stops being a slogan: give it two
 * ranges and a board and it answers with a number.
 */
export function rangeReaches(
  notation: string,
  board: readonly Card[],
  threshold: number,
): { share: number; hits: number; combos: number } {
  const onBoard = new Set(board);
  let hits = 0;
  let combos = 0;
  for (const hole of rangeCombos(notation)) {
    if (onBoard.has(hole[0]) || onBoard.has(hole[1])) continue;
    combos++;
    if (evaluate([...hole, ...board]) >= threshold) hits++;
  }
  return { share: combos ? hits / combos : 0, hits, combos };
}

/** That, as a share of all hands — what "opening 20%" means. */
export const rangeShare = (notation: string): number => rangeSize(notation) / countCombinations(52, 2);

/* ------------------------------------------------------------------ *
 * The everyday numbers
 * ------------------------------------------------------------------ */

/** Chance a draw with `outs` outs gets there on the turn. */
export const outsByTurn = (outs: number): number => outs / 47;

/** Chance it gets there on the river, having missed the turn. */
export const outsTurnToRiver = (outs: number): number => outs / 46;

/** Chance it gets there by the river, seeing both cards. */
export const outsByRiver = (outs: number): number => 1 - ((47 - outs) / 47) * ((46 - outs) / 46);

/** The rule of 4 and 2 — the shortcut, kept honest by the exact figures above. */
export const ruleOfFourAndTwo = (outs: number, cardsToCome: 1 | 2): number =>
  (outs * (cardsToCome === 2 ? 4 : 2)) / 100;

/** What a call must win to break even, facing `bet` into `pot` — `pot` before the bet. */
export const callNeeds = (bet: number, pot: number): number => bet / (pot + 2 * bet);

/**
 * The same question when the pot already holds every chip bet so far, which is
 * how preflop raises are easiest to count: `pot` includes their raise, and
 * `toCall` is only what you still have to add.
 */
export const priceFacing = (toCall: number, pot: number): number => toCall / (pot + toCall);

/** How often a bluff of `bet` into `pot` has to work to break even. */
export const bluffNeeds = (bet: number, pot: number): number => bet / (pot + bet);

/** Minimum defence frequency — how often the pot must be defended. */
export const mdf = (bet: number, pot: number): number => pot / (pot + bet);

/** Bluffs per value hand that leaves a bluff-catcher indifferent. */
export const bluffsPerValue = (bet: number, pot: number): number => bet / pot / (1 + bet / pot);

/**
 * What share of a balanced betting range should be bluffs, at this size.
 *
 * This is the same number as `callNeeds` — the fraction of your bets that are
 * bluffs is exactly the equity your opponent's call requires. That identity is
 * what "balanced" means, written down.
 */
export const bluffShare = (bet: number, pot: number): number => bet / (pot + 2 * bet);

/* ------------------------------------------------------------------ *
 * Stack depth
 * ------------------------------------------------------------------ */

/** Stack-to-pot ratio: what is left behind, measured in pots. */
export const spr = (effectiveStack: number, pot: number): number => effectiveStack / pot;

/**
 * The equity a hand needs before getting the whole stack in is profitable.
 * Rises with stack depth and never reaches 50% — which is why a shallow stack
 * commits with hands a deep one has to fold.
 */
export const commitEquity = (stackToPot: number): number => stackToPot / (1 + 2 * stackToPot);

/** The SPR at which exactly `bets` pot-sized bets put the stacks all-in. */
export const sprForPotBets = (bets: number): number => (3 ** bets - 1) / 2;

/* ------------------------------------------------------------------ *
 * Expected value
 * ------------------------------------------------------------------ */

/**
 * What a call is worth, in the units the pot is counted in.
 * `pot` is everything in the middle before you call, including their bet.
 * Zero exactly where `equity` meets `priceFacing(toCall, pot)`.
 */
export const evCall = (equity: number, toCall: number, pot: number): number =>
  equity * pot - (1 - equity) * toCall;

/**
 * What a bluff is worth: they fold `foldChance` of the time and you take the
 * pot, otherwise you lose the bet. Zero at `bluffNeeds(bet, pot)`.
 */
export const evBluff = (foldChance: number, bet: number, pot: number): number =>
  foldChance * pot - (1 - foldChance) * bet;

/**
 * A semi-bluff: the fold equity of a bluff, plus what the hand is still worth
 * on the times it gets called. This is why a draw would rather raise than call.
 */
export const evSemiBluff = (
  foldChance: number,
  equityWhenCalled: number,
  bet: number,
  pot: number,
): number =>
  foldChance * pot +
  (1 - foldChance) * (equityWhenCalled * (pot + bet) - (1 - equityWhenCalled) * bet);
