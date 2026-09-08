/**
 * The games the chip tool sets up, recorded.
 *
 * Plain CRUD on `games` and `game_seats`, like [[chipCase]] and for the same reason:
 * nothing here is economy-bearing, so the tables' own policies — scoped to
 * `auth.uid() = user_id` (§3) — are the whole of the protection, and no RPC has to stand
 * in front of them.
 *
 * **One evening is one row.** Dealing is not a single event the way an answer is: the
 * case gets edited and the stacks dealt again, twice or three times, before anyone sits
 * down. So the store carries a `client_event_id` across those deals and the row is
 * upserted on it (§3 rule 9). A new id is generated only once the end-of-game counts are
 * in — after that the evening is over, and the next deal is a new game.
 *
 * **The maths is not redone here.** `src/lib/balance.ts` works out what a seat's chips
 * came to, and `balance_points` stores that answer. The server keeps a record of what the
 * tool decided, not a second implementation of it that could disagree.
 *
 * Failures are silent, exactly as in [[chipCase]]: a write that cannot reach the table
 * costs a row in "Your games", not a lesson or a heart, and the player has nothing useful
 * to do about it. Each one is retried once and then dropped.
 */

import { supabase } from '../auth/supabase';
import type { ChipColor, DealResult } from '../lib/chips';
import { toChipColors } from './chipCase';
import type { Json } from './database.types';

/** How many games "Your games" shows. The handoff's panel lists three. */
export const RECENT_GAMES = 3;

/** How long seat edits sit before they are sent. Typing a count is a burst of them. */
export const SEATS_DEBOUNCE_MS = 800;

/** A game as it was dealt — everything the row holds except the seats. */
export type GameDeal = {
  /** what keeps one evening on one row across re-deals */
  eventId: string;
  players: number;
  /** entry in points (units × 100) */
  buyIn: number;
  /** points each seat was dealt */
  dealtStack: number;
  deal: DealResult;
  /** the case it was played with, so "Reuse" can set the tool back up as it was */
  colors: ChipColor[];
  /** whether those values were the ladder's or the player's own */
  autoValues: boolean;
};

/** One seat at the end of the night. */
export type SeatEntry = {
  index: number;
  name: string | null;
  endPoints: number;
  /** what `src/lib/balance.ts` made of those points, against the entry */
  balancePoints: number;
};

/** A recorded game, as "Your games" reads it back. */
export type RecordedGame = {
  id: string;
  playedAt: string;
  players: number;
  /** entry in points (units × 100) */
  buyIn: number;
  dealtStack: number;
  /** the owner's own balance in points, or null for a game nobody has counted yet */
  netPoints: number | null;
  /**
   * The case it was played with, or null for a game recorded before games kept one.
   * Such a row can still be reused for its players and entry; there is simply no case
   * to put back.
   */
  colors: ChipColor[] | null;
  autoValues: boolean;
};

/**
 * The row id the server gave this evening, kept so the seats can be hung off it without
 * asking again. Dropped by {@link forgetGames} when the player leaves.
 */
let recorded: { userId: string; eventId: string; gameId: string } | null = null;

/** The newest seats waiting to be written — older ones are simply overwritten here. */
let queued: {
  userId: string;
  deal: GameDeal;
  seats: SeatEntry[];
  onSaved?: () => void;
} | null = null;

let timer: ReturnType<typeof setTimeout> | null = null;

/** One write at a time, so a debounce that fires mid-flight queues behind it. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Writes the game as it now stands and answers with its row id, or null if it could not
 * be written. Called again for every re-deal of the same evening, which updates that row
 * rather than adding one: `played_at` is never sent, so it keeps the hour the first deal
 * gave it.
 */
export async function recordDeal(userId: string, deal: GameDeal): Promise<string | null> {
  const { data, error } = await supabase
    .from('games')
    .upsert(
      {
        user_id: userId,
        client_event_id: deal.eventId,
        players: deal.players,
        buy_in: deal.buyIn,
        dealt_stack: deal.dealtStack,
        deal: deal.deal as unknown as Json,
        colors: deal.colors as unknown as Json,
        auto_values: deal.autoValues,
      },
      { onConflict: 'user_id,client_event_id' },
    )
    .select('id')
    .single();

  if (error || !data) return null;

  recorded = { userId, eventId: deal.eventId, gameId: data.id };
  return data.id;
}

/**
 * Records the seats once the edits stop. Returns nothing on purpose — a count typed into
 * the Balance card never waits on a round trip, and the tally on screen is the player's
 * answer either way.
 */
export function saveSeats(
  userId: string,
  deal: GameDeal,
  seats: SeatEntry[],
  onSaved?: () => void,
): void {
  queued = { userId, deal, seats, onSaved };

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, SEATS_DEBOUNCE_MS);
}

/** Sends whatever is waiting now, rather than at the end of the debounce. */
export function flushSeats(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  return run();
}

/** Signing out: the pending seats and the row id both belong to the player leaving. */
export function forgetGames(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  queued = null;
  recorded = null;
}

function run(): Promise<void> {
  const next = chain.then(send, send);
  chain = next.catch(() => undefined);
  return next;
}

async function send(): Promise<void> {
  const pending = queued;
  if (!pending) return;
  queued = null;

  const { userId, deal, seats, onSaved } = pending;

  // The seats hang off the game by a foreign key, so an evening whose own write failed —
  // no signal at the table — is written again here rather than taking the counts down
  // with it.
  const known =
    recorded && recorded.userId === userId && recorded.eventId === deal.eventId
      ? recorded.gameId
      : null;
  const gameId = known ?? (await recordDeal(userId, deal));
  if (!gameId) return;

  let ok = await write(userId, gameId, seats);

  // One retry, and only while nothing newer is waiting: a newer count says everything
  // this one did, and its own write is already scheduled.
  if (!ok && !queued) ok = await write(userId, gameId, seats);
  if (ok) onSaved?.();
}

async function write(userId: string, gameId: string, seats: SeatEntry[]): Promise<boolean> {
  const { error } = await supabase.from('game_seats').upsert(
    seats.map((seat) => ({
      game_id: gameId,
      user_id: userId,
      seat_index: seat.index,
      name: seat.name,
      end_points: seat.endPoints,
      balance_points: seat.balancePoints,
    })),
    { onConflict: 'game_id,seat_index' },
  );

  return !error;
}

/**
 * The last few games, newest first, RLS-scoped to the caller. Null on a failure rather
 * than an empty list: "no games yet" is a thing to say to a player, and a dead network is
 * not it. How many games there are in all is `get_state()`'s answer, not a second count
 * taken here that could disagree with the one on the stat card.
 */
export async function fetchGames(limit = RECENT_GAMES): Promise<RecordedGame[] | null> {
  const { data, error } = await supabase
    .from('games')
    .select('id, played_at, players, buy_in, dealt_stack, colors, auto_values')
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error || !data) return null;

  const nets = await fetchNets(data.map((row) => row.id));

  return data.map((row) => ({
    id: row.id,
    playedAt: row.played_at,
    players: row.players,
    buyIn: row.buy_in,
    dealtStack: row.dealt_stack,
    netPoints: nets.get(row.id) ?? null,
    colors: row.colors === null ? null : toChipColors(row.colors),
    // an older row has no answer; the ladder is what it would have been dealt with
    autoValues: row.auto_values ?? true,
  }));
}

/**
 * Seat one's balance for each of those games — the player's own, by the convention the
 * Balance card states out loud: the first seat is yours.
 */
async function fetchNets(ids: string[]): Promise<Map<string, number>> {
  const nets = new Map<string, number>();
  if (ids.length === 0) return nets;

  const { data, error } = await supabase
    .from('game_seats')
    .select('game_id, balance_points')
    .in('game_id', ids)
    .eq('seat_index', 0);

  if (error || !data) return nets;
  for (const seat of data) nets.set(seat.game_id, seat.balance_points);
  return nets;
}
