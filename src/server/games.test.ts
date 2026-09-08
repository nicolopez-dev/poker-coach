/**
 * Recording games against a faked pair of tables.
 *
 * The rule worth testing is the one the schema cannot enforce on its own: one evening is
 * one row. Dealing again has to land on the row already there, a settled game has to
 * start a new one, and the seats have to find their game even when the deal that should
 * have created it never reached the table.
 */

type MockGame = {
  id: string;
  user_id: string;
  client_event_id: string;
  players: number;
  buy_in: number;
  dealt_stack: number;
  played_at: string;
  colors: unknown;
  auto_values: boolean | null;
};

type MockSeat = {
  game_id: string;
  user_id: string;
  seat_index: number;
  name: string | null;
  end_points: number;
  balance_points: number;
};

const mockGames: MockGame[] = [];
const mockSeats: MockSeat[] = [];

/** Writes that should fail before one is allowed through. */
let mockFailWrites = 0;
let mockFailReads = false;
/** Held open, a seat write waits here — where a newer count can arrive mid-flight. */
let mockGate: Promise<void> | null = null;
let mockIds = 0;
/** Every deal upsert seen, so a re-deal that added a row instead of updating one shows. */
let mockDealWrites = 0;

jest.mock('../auth/supabase', () => {
  const failed = { data: null, error: { message: 'nope' } };

  /** The games upsert: awaited by nobody, read through .select('id').single(). */
  const upsertGame = (row: MockGame & { deal: unknown }) => ({
    select: () => ({
      single: async () => {
        mockDealWrites++;
        if (mockFailWrites > 0) {
          mockFailWrites--;
          return failed;
        }
        const existing = mockGames.find(
          (g) => g.user_id === row.user_id && g.client_event_id === row.client_event_id,
        );
        if (existing) {
          Object.assign(existing, { ...row, id: existing.id, played_at: existing.played_at });
          return { data: { id: existing.id }, error: null };
        }
        const created = { ...row, id: `game-${++mockIds}`, played_at: new Date().toISOString() };
        mockGames.push(created);
        return { data: { id: created.id }, error: null };
      },
    }),
  });

  const upsertSeats = async (rows: MockSeat[]) => {
    if (mockGate) {
      const gate = mockGate;
      mockGate = null;
      await gate;
    }
    if (mockFailWrites > 0) {
      mockFailWrites--;
      return { error: { message: 'nope' } };
    }
    for (const row of rows) {
      const seat = mockSeats.find(
        (s) => s.game_id === row.game_id && s.seat_index === row.seat_index,
      );
      if (seat) Object.assign(seat, row);
      else mockSeats.push({ ...row });
    }
    return { error: null };
  };

  /** A query builder: the filters are recorded and applied when it is awaited. */
  const query = (table: string) => {
    let limit = Infinity;
    let ids: string[] | null = null;
    let seatIndex: number | null = null;

    const run = () => {
      if (mockFailReads) return failed;
      if (table === 'games') {
        const rows = [...mockGames]
          .sort((a, b) => b.played_at.localeCompare(a.played_at))
          .slice(0, limit);
        return { data: rows, error: null };
      }
      const rows = mockSeats.filter(
        (s) =>
          (!ids || ids.includes(s.game_id)) && (seatIndex === null || s.seat_index === seatIndex),
      );
      return { data: rows, error: null };
    };

    const builder = {
      order: () => builder,
      limit: (n: number) => {
        limit = n;
        return builder;
      },
      in: (_column: string, values: string[]) => {
        ids = values;
        return builder;
      },
      eq: (_column: string, value: number) => {
        seatIndex = value;
        return builder;
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };

    return builder;
  };

  return {
    supabase: {
      from: (table: string) => ({
        upsert: (rows: never) =>
          table === 'games' ? upsertGame(rows) : upsertSeats(rows as unknown as MockSeat[]),
        select: () => query(table),
      }),
    },
  };
});

import type { ChipColor, DealResult } from '../lib/chips';
import {
  SEATS_DEBOUNCE_MS,
  fetchGames,
  flushSeats,
  forgetGames,
  recordDeal,
  saveSeats,
  type GameDeal,
  type SeatEntry,
} from './games';

const ALICE = '11111111-1111-4111-8111-111111111111';

const RESULT: DealResult = {
  order: [0, 1],
  denoms: [5, 25],
  qty: [10, 18],
  val: 500,
  ok: true,
  total: 28,
};

const CASE: ChipColor[] = [
  { name: 'Bone', swatch: '#f4f1e6', count: 25, value: 5 },
  { name: 'Clay', swatch: '#ff7a63', count: 25, value: 25 },
];

const dealOf = (eventId: string, over: Partial<GameDeal> = {}): GameDeal => ({
  eventId,
  players: 6,
  buyIn: 500,
  dealtStack: RESULT.val,
  deal: RESULT,
  colors: CASE,
  autoValues: false,
  ...over,
});

const seatsOf = (...ends: number[]): SeatEntry[] =>
  ends.map((end, index) => ({
    index,
    name: index === 0 ? 'You' : null,
    endPoints: end,
    balancePoints: end - 500,
  }));

async function settle(): Promise<void> {
  jest.advanceTimersByTime(SEATS_DEBOUNCE_MS);
  await flushSeats();
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetGames();
  mockGames.length = 0;
  mockSeats.length = 0;
  mockFailWrites = 0;
  mockFailReads = false;
  mockGate = null;
  mockIds = 0;
  mockDealWrites = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('one evening, one row', () => {
  it('keeps the same row when the case is edited and the stacks dealt again', async () => {
    const first = await recordDeal(ALICE, dealOf('evening-1'));
    const again = await recordDeal(ALICE, dealOf('evening-1', { players: 8, dealtStack: 400 }));

    expect(mockDealWrites).toBe(2);
    expect(mockGames).toHaveLength(1);
    expect(again).toBe(first);
    expect(mockGames[0].players).toBe(8);
  });

  it('leaves the hour of the first deal alone', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    const dealtAt = mockGames[0].played_at;

    await recordDeal(ALICE, dealOf('evening-1', { players: 4 }));

    expect(mockGames[0].played_at).toBe(dealtAt);
  });

  it('starts a new row for the next evening', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    await recordDeal(ALICE, dealOf('evening-2'));

    expect(mockGames).toHaveLength(2);
  });

  it('says so rather than throwing when the row cannot be written', async () => {
    mockFailWrites = 1;
    expect(await recordDeal(ALICE, dealOf('evening-1'))).toBeNull();
    expect(mockGames).toHaveLength(0);
  });
});

describe('the seats', () => {
  it('sends one write for a burst of counts, carrying the last', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));

    for (const end of [100, 900, 1200]) {
      saveSeats(ALICE, dealOf('evening-1'), seatsOf(end, 400));
      jest.advanceTimersByTime(SEATS_DEBOUNCE_MS - 100);
    }
    await settle();

    expect(mockSeats).toHaveLength(2);
    expect(mockSeats[0]).toMatchObject({ seat_index: 0, name: 'You', end_points: 1200 });
  });

  it('stores the balance the tool worked out, untouched', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1200, 300));
    await settle();

    // seatsOf() hands over end − 500; the server is a record of that, not a second
    // implementation of src/lib/balance.ts
    expect(mockSeats.map((s) => s.balance_points)).toEqual([700, -200]);
  });

  it('writes the game itself when the deal never reached the table', async () => {
    mockFailWrites = 1;
    expect(await recordDeal(ALICE, dealOf('evening-1'))).toBeNull();

    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1200, 300));
    await settle();

    expect(mockGames).toHaveLength(1);
    expect(mockSeats).toHaveLength(2);
  });

  it('retries a failed write once, and says nothing until one lands', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));

    const saved = jest.fn();
    mockFailWrites = 5;
    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1200, 300), saved);
    await settle();

    expect(mockSeats).toHaveLength(0);
    expect(saved).not.toHaveBeenCalled();
    // two attempts, and only two
    expect(mockFailWrites).toBe(3);
  });

  it('tells the caller once the counts are in', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));

    const saved = jest.fn();
    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1200, 300), saved);
    await settle();

    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('abandons the retry when a newer count is already waiting', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));

    mockFailWrites = 1;
    let open = () => {};
    mockGate = new Promise<void>((resolve) => {
      open = resolve;
    });

    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1200, 300));
    await jest.advanceTimersByTimeAsync(SEATS_DEBOUNCE_MS);

    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1300, 200));
    open();
    await settle();

    expect(mockSeats.map((s) => s.end_points)).toEqual([1300, 200]);
  });

  it('drops what was waiting when the player signs out', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    saveSeats(ALICE, dealOf('evening-1'), seatsOf(1200, 300));
    forgetGames();
    await settle();

    expect(mockSeats).toHaveLength(0);
  });
});

describe('reading them back', () => {
  it('answers newest first, with the owner’s own balance', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    await recordDeal(ALICE, dealOf('evening-2'));
    // the second evening is the newer one; give it a later hour than the first
    mockGames[0].played_at = '2026-08-21T20:00:00.000Z';
    mockGames[1].played_at = '2026-08-28T20:00:00.000Z';

    saveSeats(ALICE, dealOf('evening-2'), seatsOf(1200, 300));
    await settle();

    const games = await fetchGames();

    expect(games?.map((g) => g.playedAt)).toEqual([
      '2026-08-28T20:00:00.000Z',
      '2026-08-21T20:00:00.000Z',
    ]);
    // seat one's balance, and nothing for the evening nobody counted
    expect(games?.map((g) => g.netPoints)).toEqual([700, null]);
    expect(games?.[0]).toMatchObject({ players: 6, buyIn: 500, dealtStack: 500 });
  });

  it('gives the case back, so Reuse has something to put back', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));

    const games = await fetchGames();

    expect(games?.[0].colors).toEqual(CASE);
    expect(games?.[0].autoValues).toBe(false);
  });

  it('has no case to give back for a game recorded before games kept one', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    mockGames[0].colors = null;
    mockGames[0].auto_values = null;

    const games = await fetchGames();

    expect(games?.[0].colors).toBeNull();
    // the ladder is what such a game would have been dealt with
    expect(games?.[0].autoValues).toBe(true);
    // and it is still reusable for the rest of the setup
    expect(games?.[0]).toMatchObject({ players: 6, buyIn: 500 });
  });

  it('asks for no more than it shows', async () => {
    for (const evening of ['a', 'b', 'c', 'd']) await recordDeal(ALICE, dealOf(evening));

    expect(await fetchGames()).toHaveLength(3);
  });

  it('answers null on a failure rather than an empty history', async () => {
    await recordDeal(ALICE, dealOf('evening-1'));
    mockFailReads = true;

    expect(await fetchGames()).toBeNull();
  });
});
