/**
 * The chip case against a faked table.
 *
 * What is worth testing here is not the CRUD — it is the four promises the module makes
 * about *when* it writes: an untouched case creates no row, a burst of edits is one
 * write, a case put back where it was is no write at all, and a failure costs one silent
 * retry that a newer case cancels.
 */

const mockUpserts: {
  user_id: string;
  colors: unknown;
  players: number;
  buy_in: number;
  auto_values: boolean;
}[] = [];

/** The row the table holds, as `maybeSingle` would answer it. */
let mockRow: unknown = null;
let mockReads = 0;
let mockReadFails = false;
/** How many writes fail before one is allowed through. */
let mockWriteFailures = 0;
/** Held open, a write waits here — which is where a newer case can arrive mid-flight. */
let mockGate: Promise<void> | null = null;

jest.mock('../auth/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        maybeSingle: async () => {
          mockReads++;
          return mockReadFails
            ? { data: null, error: { message: 'unreachable' } }
            : { data: mockRow, error: null };
        },
      }),
      upsert: async (row: (typeof mockUpserts)[number]) => {
        if (mockGate) {
          const gate = mockGate;
          mockGate = null;
          await gate;
        }
        mockUpserts.push(row);
        if (mockWriteFailures > 0) {
          mockWriteFailures--;
          return { error: { message: 'nope' } };
        }
        const { user_id: _owner, ...held } = row;
        mockRow = held;
        return { error: null };
      },
    }),
  },
}));

import { DEFAULT_CASE, DEFAULT_COLORS, MAX_CHIP_COUNT, MAX_PLAYERS } from '../data/chipCase';
import {
  SAVE_DEBOUNCE_MS,
  flushChipCase,
  forgetChipCase,
  loadChipCase,
  saveChipCase,
  type ChipCase,
} from './chipCase';

const ALICE = '11111111-1111-4111-8111-111111111111';

/** A case that is nobody's default: three colours, four seats, ten units, by hand. */
const MINE: ChipCase = {
  colors: [
    { name: 'Bone', swatch: '#f4f1e6', count: 25, value: 1 },
    { name: 'Clay', swatch: '#ff7a63', count: 25, value: 5 },
    { name: 'Slate', swatch: '#1a1a1a', count: 25, value: 25 },
  ],
  players: 4,
  buyIn: 1000,
  autoValues: false,
};

const rowOf = (chipCase: ChipCase) => ({
  colors: chipCase.colors,
  players: chipCase.players,
  buy_in: chipCase.buyIn,
  auto_values: chipCase.autoValues,
});

/** The debounce runs out and whatever it started is awaited. */
async function settle(): Promise<void> {
  jest.advanceTimersByTime(SAVE_DEBOUNCE_MS);
  await flushChipCase();
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetChipCase();
  mockUpserts.length = 0;
  mockRow = null;
  mockReads = 0;
  mockReadFails = false;
  mockWriteFailures = 0;
  mockGate = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('saving', () => {
  it('creates no row for a case nobody has touched', async () => {
    saveChipCase(ALICE, DEFAULT_CASE);
    await settle();

    expect(mockUpserts).toHaveLength(0);
    // and it did not even ask: there is nothing a read could have changed about this
    expect(mockReads).toBe(0);
  });

  it('writes the default colours along with the first change', async () => {
    saveChipCase(ALICE, { ...DEFAULT_CASE, players: 8 });
    await settle();

    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0]).toMatchObject({ user_id: ALICE, players: 8, buy_in: DEFAULT_CASE.buyIn });
    expect(mockUpserts[0].colors).toEqual(DEFAULT_COLORS);
  });

  it('sends one write for a burst of edits, carrying the last', async () => {
    for (const players of [7, 8, 9]) {
      saveChipCase(ALICE, { ...DEFAULT_CASE, players });
      jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 100);
    }
    await settle();

    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0].players).toBe(9);
  });

  it('writes nothing when an edit is undone before it is sent', async () => {
    mockRow = rowOf(MINE);
    await loadChipCase(ALICE);

    saveChipCase(ALICE, { ...MINE, players: 6 });
    jest.advanceTimersByTime(SAVE_DEBOUNCE_MS - 100);
    saveChipCase(ALICE, MINE);
    await settle();

    expect(mockUpserts).toHaveLength(0);
  });

  it('does not write the case straight back after reading it', async () => {
    mockRow = rowOf(MINE);
    const loaded = await loadChipCase(ALICE);

    // exactly what the store does with it: adopt it, which counts as a change
    saveChipCase(ALICE, loaded!);
    await settle();

    expect(mockUpserts).toHaveLength(0);
  });

  it('retries a failed write once, and only once', async () => {
    mockWriteFailures = 5;
    saveChipCase(ALICE, MINE);
    await settle();

    expect(mockUpserts).toHaveLength(2);
  });

  it('keeps what the retry saved, so the next identical save is a no-op', async () => {
    mockWriteFailures = 1;
    saveChipCase(ALICE, MINE);
    await settle();
    expect(mockUpserts).toHaveLength(2);

    saveChipCase(ALICE, MINE);
    await settle();
    expect(mockUpserts).toHaveLength(2);
  });

  it('abandons the retry when a newer case is already waiting', async () => {
    mockWriteFailures = 1;
    let open = () => {};
    mockGate = new Promise<void>((resolve) => {
      open = resolve;
    });

    saveChipCase(ALICE, MINE);
    // async, so the write actually starts and parks on the gate
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    // the write is held open; the player edits again while it is in the air
    saveChipCase(ALICE, { ...MINE, players: 5 });
    open();
    await settle();

    // the failed case is not sent twice — the newer one says everything it did
    expect(mockUpserts).toHaveLength(2);
    expect(mockUpserts[0].players).toBe(MINE.players);
    expect(mockUpserts[1].players).toBe(5);
  });

  it('never writes a case built on a read it could not make', async () => {
    mockReadFails = true;
    saveChipCase(ALICE, { ...DEFAULT_CASE, players: 8 });
    await settle();
    expect(mockUpserts).toHaveLength(0);

    // and asks again on the next edit rather than giving up for the session
    mockReadFails = false;
    saveChipCase(ALICE, { ...DEFAULT_CASE, players: 8 });
    await settle();
    expect(mockUpserts).toHaveLength(1);
  });

  it('drops a pending write when the player signs out', async () => {
    saveChipCase(ALICE, MINE);
    forgetChipCase();
    await settle();

    expect(mockUpserts).toHaveLength(0);
  });

  it('keeps nothing across a sign-out, not even from a write still in the air', async () => {
    mockRow = rowOf(MINE);
    await loadChipCase(ALICE);

    let open = () => {};
    mockGate = new Promise<void>((resolve) => {
      open = resolve;
    });

    saveChipCase(ALICE, { ...MINE, players: 5 });
    await jest.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS);

    // signing out while that write is parked, then straight back in
    forgetChipCase();
    open();
    await flushChipCase();

    // the untouched case a fresh sign-in starts on must not read as a change worth
    // sending — that would put the defaults over the row the player actually has
    saveChipCase(ALICE, DEFAULT_CASE);
    await settle();

    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0].players).toBe(5);
  });
});

describe('loading', () => {
  it('has nothing to say about an account with no row', async () => {
    expect(await loadChipCase(ALICE)).toBeNull();
  });

  it('reads a case back exactly as it was written', async () => {
    mockRow = rowOf(MINE);
    expect(await loadChipCase(ALICE)).toEqual(MINE);
  });

  it('keeps the defaults rather than a row it cannot read', async () => {
    mockReadFails = true;
    expect(await loadChipCase(ALICE)).toBeNull();
  });

  it('drops a malformed case instead of feeding it to the solver', async () => {
    for (const colors of [null, 'red', [], [{ name: 'Bone', swatch: '#fff', count: 'many' }]]) {
      mockRow = { ...rowOf(MINE), colors };
      expect(await loadChipCase(ALICE)).toBeNull();
    }

    mockRow = { ...rowOf(MINE), players: null };
    expect(await loadChipCase(ALICE)).toBeNull();
  });

  it('clamps a case that is out of range rather than dropping it', async () => {
    mockRow = rowOf({
      ...MINE,
      players: 99,
      colors: [
        { name: 'Bone', swatch: '#f4f1e6', count: 9999, value: 0 },
        { name: 'Clay', swatch: '#ff7a63', count: 25, value: 5 },
      ],
    });

    const loaded = await loadChipCase(ALICE);
    expect(loaded?.players).toBe(MAX_PLAYERS);
    expect(loaded?.colors[0].count).toBe(MAX_CHIP_COUNT);
    // a worthless chip is not a chip; the smallest denomination is one point
    expect(loaded?.colors[0].value).toBe(1);
  });
});
