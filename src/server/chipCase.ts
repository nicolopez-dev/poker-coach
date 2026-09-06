/**
 * The chip case, read on sign-in and written back as it is edited.
 *
 * Plain CRUD on `chip_cases`, not an RPC: nothing here is economy-bearing, so the table's
 * own policy — `for all` scoped to `auth.uid() = user_id` (§3) — is the whole of the
 * protection. There is no user id in the select for that reason; RLS decides whose row
 * comes back.
 *
 * The rule this module exists to keep is that **the save must never fight the user**.
 * Which means, in order:
 *
 *   · **Debounced.** Every edit restarts an {@link SAVE_DEBOUNCE_MS} timer and only the
 *     newest case is ever sent, so holding a stepper down is one write, not thirty.
 *   · **Last write wins.** No merge, no conflict, no version. The case is a preference,
 *     and the phone the player is holding is right by definition.
 *   · **Never blocking.** `saveChipCase` returns nothing and is called for its effect; a
 *     keystroke never waits on the network, and a deal on screen is never invalidated,
 *     because nothing here touches the store.
 *   · **Silent.** A failed write is retried once and then dropped. There is no copy for
 *     it: a player who cannot save their chip colours has nothing useful to do about it,
 *     and the next edit tries again anyway.
 *
 * And one rule about rows: **an untouched case does not create one**. A save is only ever
 * sent when the case differs from what the server already has — from the row it sent, or,
 * for an account that has none, from {@link DEFAULT_CASE}. So a player who never opens the
 * chip tool has no `chip_cases` row, and the first player who changes anything writes the
 * default colours along with the change.
 *
 * Nothing is written until a read has succeeded, either. A case assembled on top of the
 * local defaults, because the row could not be fetched, would overwrite a case we simply
 * failed to see.
 */

import { supabase } from '../auth/supabase';
import {
  DEFAULT_CASE,
  MAX_BUY_IN_UNITS,
  MAX_CHIP_COUNT,
  MAX_CHIP_VALUE,
  MAX_COLORS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_COLORS,
  MIN_PLAYERS,
} from '../data/chipCase';
import { POINTS_PER_UNIT } from '../lib/balance';
import type { ChipColor } from '../lib/chips';
import { clamp } from '../lib/num';
import type { Json } from './database.types';

/** The case as the app speaks it — the same shape `deal()` takes. */
export type ChipCase = {
  colors: ChipColor[];
  players: number;
  /** entry in points (units × 100) */
  buyIn: number;
  autoValues: boolean;
};

/** How long an edit sits before it is sent. Long enough to swallow a held stepper. */
export const SAVE_DEBOUNCE_MS = 800;

/** Rows come back snake_case; the app speaks camelCase everywhere else. */
type CaseRow = {
  colors: Json;
  players: number;
  buy_in: number;
  auto_values: boolean;
};

/**
 * What the server has, as far as this session knows: the case it sent, or the defaults
 * when it sent no row at all. Null means the question has not been answered yet, and
 * nothing is written while it is.
 */
type Known = { userId: string; json: string; chipCase: ChipCase | null };

let known: Known | null = null;

/** The newest case waiting to be sent — older ones are simply overwritten here. */
let queued: { userId: string; chipCase: ChipCase } | null = null;

let timer: ReturnType<typeof setTimeout> | null = null;

/** One write at a time, so a debounce that fires mid-flight queues behind it. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Bumped by {@link forgetChipCase}. A read or a write still in the air when a player
 * signs out must not write its answer into the baseline afterwards: the next sign-in
 * would inherit it, and a case that has never been read would then look like a change
 * worth sending — the defaults, over the row the player actually has.
 */
let generation = 0;

/**
 * Two cases the server cannot tell apart. Field by field rather than `JSON.stringify` of
 * the objects themselves, because key order is not part of what a case *is*.
 */
export function sameCase(a: ChipCase, b: ChipCase): boolean {
  return serialize(a) === serialize(b);
}

function serialize(chipCase: ChipCase): string {
  return JSON.stringify([
    chipCase.players,
    chipCase.buyIn,
    chipCase.autoValues,
    chipCase.colors.map((c) => [c.name, c.swatch, c.count, c.value]),
  ]);
}

/**
 * The caller's own case, or null when they have no row yet — in which case the store
 * keeps the defaults it started with, and no row is created until something changes.
 *
 * A read that fails answers null as well, and leaves this session with no baseline: the
 * next save will try the read again rather than write over a case it never saw.
 */
export async function loadChipCase(userId: string): Promise<ChipCase | null> {
  return (await learn(userId))?.chipCase ?? null;
}

async function learn(userId: string): Promise<Known | null> {
  const mine = generation;
  const { data, error } = await supabase
    .from('chip_cases')
    .select('colors, players, buy_in, auto_values')
    .maybeSingle();

  if (error) return null;

  const chipCase = toChipCase(data);
  const settled: Known = { userId, json: serialize(chipCase ?? DEFAULT_CASE), chipCase };
  if (generation === mine) known = settled;
  return settled;
}

/**
 * Records the case as it now stands and sends it once the edits stop. Returns nothing on
 * purpose: there is no result a caller could use and nothing worth waiting for.
 */
export function saveChipCase(userId: string, chipCase: ChipCase): void {
  // Deliberately not compared to the baseline here: a case edited and put back within
  // the debounce would otherwise leave the earlier edit queued and send *that*.
  queued = { userId, chipCase };

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, SAVE_DEBOUNCE_MS);
}

/** Sends whatever is waiting now, rather than at the end of the debounce. */
export function flushChipCase(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  return run();
}

/** Signing out: the pending write and the baseline both belong to the player leaving. */
export function forgetChipCase(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  queued = null;
  known = null;
  generation++;
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

  const mine = generation;
  const { userId, chipCase } = pending;

  // Nothing has been touched and nothing is known: there is no row to correct and none
  // worth creating, so this costs not even a read.
  if (known?.userId !== userId && sameCase(chipCase, DEFAULT_CASE)) return;

  const baseline = known?.userId === userId ? known : await learn(userId);
  // The read failed. Silence, and the next edit asks again.
  if (!baseline) return;

  const json = serialize(chipCase);
  if (json === baseline.json) return;

  let ok = await write(userId, chipCase);

  // One retry, and only while nothing newer is waiting: a newer case says everything
  // this one did, and its own write is already scheduled.
  if (!ok && !queued) ok = await write(userId, chipCase);
  if (!ok) return;

  if (generation === mine) known = { userId, json, chipCase };
}

async function write(userId: string, chipCase: ChipCase): Promise<boolean> {
  // `user_id` is the primary key, so this is an insert for a first save and an update
  // for every one after it.
  const { error } = await supabase.from('chip_cases').upsert({
    user_id: userId,
    colors: chipCase.colors as unknown as Json,
    players: chipCase.players,
    buy_in: chipCase.buyIn,
    auto_values: chipCase.autoValues,
  });

  return !error;
}

/**
 * A row, validated the way [[stateCache]] validates its blob: the chip solver is fed
 * straight from this, and a `NaN` denomination or a case of one colour would break it in
 * ways that look like a bug in the maths. Anything malformed is no case at all, and the
 * defaults stand.
 *
 * Numbers that are merely out of range are clamped instead of rejected — the same bounds
 * the editors themselves enforce, applied to a row that has come back from a build that
 * may not have had them.
 */
function toChipCase(row: CaseRow | null): ChipCase | null {
  if (!row) return null;
  if (typeof row.auto_values !== 'boolean') return null;
  if (!isNumber(row.players) || !isNumber(row.buy_in)) return null;

  const colors = toColors(row.colors);
  if (!colors) return null;

  return {
    colors,
    players: clamp(Math.round(row.players), MIN_PLAYERS, MAX_PLAYERS),
    buyIn: clamp(Math.round(row.buy_in), 1, MAX_BUY_IN_UNITS * POINTS_PER_UNIT),
    autoValues: row.auto_values,
  };
}

function toColors(value: Json): ChipColor[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length < MIN_COLORS || value.length > MAX_COLORS) return null;

  const colors: ChipColor[] = [];

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
    const color = entry as Record<string, unknown>;

    const { name, swatch, count, value: points } = color;
    if (typeof name !== 'string' || typeof swatch !== 'string') return null;
    if (!isNumber(count) || !isNumber(points)) return null;

    colors.push({
      name: name.slice(0, MAX_NAME_LENGTH),
      swatch,
      count: clamp(Math.round(count), 0, MAX_CHIP_COUNT),
      value: clamp(Math.round(points), 1, MAX_CHIP_VALUE),
    });
  }

  return colors;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
