/**
 * The outbox on its own, against a server that can be told how to behave.
 *
 * The cases that matter are the ones where something goes wrong halfway: the queue has
 * to come out of a failed flush in a state that is safe to retry whole, and it has to
 * tell the caller enough to be honest with the player about what was lost.
 */

jest.mock('../auth/supabase', () => ({ supabase: { auth: {} } }));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ServerError, type AnswerOutcome, type PlayerState } from './client';
import {
  OUTBOX_LIMIT,
  clearOutbox,
  enqueue,
  flush,
  pending,
  type OutboxEvent,
} from './outbox';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

/** A server that records what it was sent and answers however the test needs. */
type Sent = { kind: string; clientEventId: string; lessonId: string };

const mockCalls: Sent[] = [];
let mockAnswer: (input: { clientEventId: string; lessonId: string }) => Promise<AnswerOutcome>;
let mockComplete: (input: { clientEventId: string; lessonId: string }) => Promise<PlayerState>;

jest.mock('../server/client', () => ({
  ...(jest.requireActual('../server/client') as object),
  submitAnswer: (input: { clientEventId: string; lessonId: string }) => mockAnswer(input),
  completeLesson: (input: { clientEventId: string; lessonId: string }) => mockComplete(input),
}));

const outcome = (hearts: number): AnswerOutcome => ({ correct: true, hearts, nextHeartAt: null });

const playerState = (): PlayerState => ({
  hearts: 3,
  nextHeartAt: null,
  streak: 2,
  streakAtRisk: false,
  streakExpiresAt: null,
  longestStreak: 9,
  storedStreak: 2,
  streakDay: '2026-09-06',
  xp: 16,
  accuracy: 1,
  completedLessons: ['l1'],
  week: [],
  lessonsToday: 0,
  chapters: {},
  games: 0,
  serverNow: '2026-09-06T12:00:00.000Z',
});

const answerEvent = (id: string, at: string, lessonId = 'l1'): OutboxEvent => ({
  kind: 'answer',
  clientEventId: id,
  occurredAt: at,
  payload: { lessonId, questionIndex: 0, chosenOptionId: 'a', tzOffsetMin: 120 },
});

const completionEvent = (id: string, at: string, lessonId = 'l1'): OutboxEvent => ({
  kind: 'completion',
  clientEventId: id,
  occurredAt: at,
  payload: { lessonId, chapterId: 'c1', tzOffsetMin: 120 },
});

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCalls.length = 0;
  mockAnswer = async (input) => {
    mockCalls.push({ kind: 'answer', ...input });
    return outcome(4);
  };
  mockComplete = async (input) => {
    mockCalls.push({ kind: 'completion', ...input });
    return playerState();
  };
});

describe('holding events', () => {
  it('keeps them oldest first, whatever order they arrive in', async () => {
    await enqueue(ALICE, answerEvent('c', '2026-09-06T10:00:03.000Z'));
    await enqueue(ALICE, answerEvent('a', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('b', '2026-09-06T10:00:02.000Z'));

    expect((await pending(ALICE)).map((e) => e.clientEventId)).toEqual(['a', 'b', 'c']);
  });

  it('survives a cold start — the queue is on disk, not in memory', async () => {
    await enqueue(ALICE, answerEvent('a', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, completionEvent('b', '2026-09-06T10:00:02.000Z'));

    // nothing is held in module state: a fresh read is all a new process does
    const queue = await pending(ALICE);

    expect(queue).toHaveLength(2);
    expect(queue[1]).toMatchObject({ kind: 'completion', payload: { chapterId: 'c1' } });
  });

  it('is one queue per player', async () => {
    await enqueue(ALICE, answerEvent('a', '2026-09-06T10:00:01.000Z'));
    expect(await pending(BOB)).toEqual([]);
  });

  it('does not queue the same event twice', async () => {
    await enqueue(ALICE, answerEvent('a', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('a', '2026-09-06T10:00:01.000Z'));

    expect(await pending(ALICE)).toHaveLength(1);
  });

  it('drops the oldest past the cap, and says so', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    for (let i = 0; i < OUTBOX_LIMIT + 3; i++) {
      // ids ascend with the instant, so the oldest are the lowest
      await enqueue(ALICE, answerEvent(`e${String(i).padStart(4, '0')}`, stamp(i)));
    }

    const queue = await pending(ALICE);
    expect(queue).toHaveLength(OUTBOX_LIMIT);
    expect(queue[0].clientEventId).toBe('e0003');
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('forgets a player’s queue on request', async () => {
    await enqueue(ALICE, answerEvent('a', '2026-09-06T10:00:01.000Z'));
    await clearOutbox(ALICE);
    expect(await pending(ALICE)).toEqual([]);
  });
});

describe('flushing', () => {
  it('sends in order and empties the queue', async () => {
    await enqueue(ALICE, answerEvent('a1', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('a2', '2026-09-06T10:00:02.000Z'));
    await enqueue(ALICE, completionEvent('c1', '2026-09-06T10:00:03.000Z'));

    const result = await flush(ALICE);

    expect(mockCalls.map((c) => c.clientEventId)).toEqual(['a1', 'a2', 'c1']);
    // the completion counts the answers it summarises, so it goes last
    expect(mockCalls[2].kind).toBe('completion');
    expect(result.sent).toBe(3);
    expect(result.state).not.toBeNull();
    expect(result.remaining).toBe(0);
    expect(await pending(ALICE)).toEqual([]);
  });

  it('leaves the queue untouched when the server cannot be reached', async () => {
    await enqueue(ALICE, answerEvent('a1', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('a2', '2026-09-06T10:00:02.000Z'));

    mockAnswer = async () => {
      throw new ServerError('UNREACHABLE', 'no server');
    };

    const result = await flush(ALICE);

    expect(result.offline).toBe(true);
    expect(result.sent).toBe(0);
    expect(result.dropped).toBe(0);
    expect((await pending(ALICE)).map((e) => e.clientEventId)).toEqual(['a1', 'a2']);
  });

  it('keeps what it did not reach when the connection goes halfway', async () => {
    await enqueue(ALICE, answerEvent('a1', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('a2', '2026-09-06T10:00:02.000Z'));
    await enqueue(ALICE, answerEvent('a3', '2026-09-06T10:00:03.000Z'));

    mockAnswer = async (input) => {
      mockCalls.push({ kind: 'answer', ...input });
      if (input.clientEventId === 'a2') throw new ServerError('UNREACHABLE', 'no server');
      return outcome(4);
    };

    const result = await flush(ALICE);

    expect(result.sent).toBe(1);
    expect(result.offline).toBe(true);
    expect((await pending(ALICE)).map((e) => e.clientEventId)).toEqual(['a2', 'a3']);
  });

  it('is safe to retry whole — the server answers a replay from what it stored', async () => {
    await enqueue(ALICE, answerEvent('a1', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('a2', '2026-09-06T10:00:02.000Z'));

    let seen = 0;
    const spent = new Set<string>();
    mockAnswer = async (input) => {
      mockCalls.push({ kind: 'answer', ...input });
      seen++;
      // the real function is idempotent on the event id: a replay costs nothing
      const first = !spent.has(input.clientEventId);
      spent.add(input.clientEventId);
      if (input.clientEventId === 'a2' && first) throw new ServerError('UNREACHABLE', 'no server');
      return outcome(4);
    };

    await flush(ALICE);
    expect((await pending(ALICE)).map((e) => e.clientEventId)).toEqual(['a2']);

    const second = await flush(ALICE);

    expect(second.sent).toBe(1);
    expect(await pending(ALICE)).toEqual([]);
    // a1 was sent once, a2 twice — and the second time cost nothing
    expect(seen).toBe(3);
    expect(spent.size).toBe(2);
  });

  it('drops everything behind an answer the server had no heart for', async () => {
    await enqueue(ALICE, answerEvent('a1', '2026-09-06T10:00:01.000Z'));
    await enqueue(ALICE, answerEvent('a2', '2026-09-06T10:00:02.000Z'));
    await enqueue(ALICE, completionEvent('c1', '2026-09-06T10:00:03.000Z'));

    mockAnswer = async (input) => {
      mockCalls.push({ kind: 'answer', ...input });
      if (input.clientEventId === 'a2') throw new ServerError('OUT_OF_HEARTS', 'out');
      return outcome(0);
    };

    const result = await flush(ALICE);

    expect(result.sent).toBe(1);
    expect(result.outOfHearts).toBe(true);
    // the refused answer and the completion that would have summarised it
    expect(result.dropped).toBe(2);
    // and the completion never reached the server, which would have accepted it
    expect(mockCalls.some((c) => c.kind === 'completion')).toBe(false);
    expect(await pending(ALICE)).toEqual([]);
  });

  it('drops a single event the server will never accept, and carries on', async () => {
    await enqueue(ALICE, completionEvent('c1', '2026-09-06T10:00:01.000Z', 'done-already'));
    await enqueue(ALICE, answerEvent('a1', '2026-09-06T10:00:02.000Z'));

    mockComplete = async (input) => {
      mockCalls.push({ kind: 'completion', ...input });
      throw new ServerError('ALREADY_COMPLETED', 'already');
    };

    const result = await flush(ALICE);

    expect(result.dropped).toBe(1);
    expect(result.sent).toBe(1);
    expect(mockCalls.map((c) => c.kind)).toEqual(['completion', 'answer']);
    expect(await pending(ALICE)).toEqual([]);
  });

  it('does nothing, quietly, when there is nothing to send', async () => {
    const result = await flush(ALICE);

    expect(result).toMatchObject({ sent: 0, dropped: 0, offline: false, remaining: 0 });
    expect(mockCalls).toEqual([]);
  });
});

/** An instant that ascends with `i`, so ordering is unambiguous. */
function stamp(i: number): string {
  return new Date(Date.UTC(2026, 8, 6, 0, 0, 0) + i * 1000).toISOString();
}
