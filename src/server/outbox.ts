/**
 * Writes that have not reached the server yet.
 *
 * Every answer and every completion goes in here first and is sent from here, online or
 * off — one path, so the offline case is not a second code path that only runs when
 * something is broken. What makes that safe is idempotency: each event carries the
 * `client_event_id` the RPCs key on (§3 rule 9), so a flush that half-fails is safe to
 * retry whole, and a crash mid-flush costs at most a few duplicate calls that the server
 * answers from what it already stored.
 *
 * Events are held in `occurred_at` order, which is also the order they are sent in: a
 * completion counts the answer rows it summarises, so it must never overtake them.
 *
 * Deliberately free of React and of the store — it takes a user id, it returns what
 * happened, and `src/state/drill.ts` decides what that means on screen. That is what
 * makes `outbox.test.ts` able to test it on its own.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  completeLesson,
  serverErrorCode,
  serverErrorMessage,
  submitAnswer,
  type AnswerOutcome,
  type PlayerState,
} from './client';

/**
 * How many events are kept. A player drilling offline for a very long time is the case
 * this bounds; past it the oldest go, because the newest are the ones whose loss the
 * player would actually notice.
 */
export const OUTBOX_LIMIT = 500;

const key = (userId: string) => `pokerCoach.outbox.v1.${userId}`;

/** Fields are camelCase here and turned into `p_` arguments by [[client]], as everywhere else. */
export type AnswerEvent = {
  kind: 'answer';
  clientEventId: string;
  occurredAt: string;
  payload: {
    lessonId: string;
    questionIndex: number;
    chosenOptionId: string;
    tzOffsetMin: number;
  };
};

export type CompletionEvent = {
  kind: 'completion';
  clientEventId: string;
  occurredAt: string;
  payload: {
    lessonId: string;
    chapterId: string;
    tzOffsetMin: number;
  };
};

export type OutboxEvent = AnswerEvent | CompletionEvent;

export type FlushResult = {
  /** events the server accepted */
  sent: number;
  /** events the server refused, and which will never be sent again */
  dropped: number;
  /** why the last of those was refused, in the app's voice, for whoever has to say so */
  refused: string | null;
  /** the flush stopped because the server could not be reached; the queue is intact */
  offline: boolean;
  /** the server refused for want of a heart, which ends everything queued behind it */
  outOfHearts: boolean;
  /** the last answer the server decided, for the drill's optimistic correction */
  answer: AnswerOutcome | null;
  /** the last whole state the server sent — what a completion replies with */
  state: PlayerState | null;
  /** how many events are still waiting */
  remaining: number;
};

const empty = (): FlushResult => ({
  sent: 0,
  dropped: 0,
  refused: null,
  offline: false,
  outOfHearts: false,
  answer: null,
  state: null,
  remaining: 0,
});

/**
 * One thing at a time.
 *
 * Every operation here is a read, a decision and a write of the same key, and two of
 * them overlapping lose each other's work: an answer queued while a flush is reading
 * would be dropped by the flush's own write, and two flushes would send the same event
 * twice — harmless to the server, which is idempotent, but it breaks the rule that
 * everything behind a refused answer is dropped.
 */
let chain: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  // both arms run `work`: one failure must not wedge everything queued behind it
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

/** Oldest first. The order events happened in is the order they have to be sent in. */
function inOrder(events: OutboxEvent[]): OutboxEvent[] {
  return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export async function pending(userId: string): Promise<OutboxEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return inOrder(parsed.filter(isEvent));
  } catch {
    // an unreadable queue is an empty one; the alternative is refusing to play
    return [];
  }
}

async function write(userId: string, events: OutboxEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(events));
  } catch {
    // nothing else can be done here: the play already happened on screen
  }
}

export async function clearOutbox(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // the next write overwrites it anyway
  }
}

/**
 * Adds an event, dropping the oldest if the queue is full. Replacing an event with the
 * same id rather than appending keeps a retried write from being queued twice.
 */
export function enqueue(userId: string, event: OutboxEvent): Promise<void> {
  return serial(() => add(userId, event));
}

async function add(userId: string, event: OutboxEvent): Promise<void> {
  // A write with no id could never be replayed safely, and would be dropped on the next
  // read as unreadable. Better to fail here, where the cause is still visible.
  if (!event.clientEventId) {
    throw new Error(`[outbox] a ${event.kind} event without a client_event_id cannot be queued`);
  }

  const events = (await pending(userId)).filter((e) => e.clientEventId !== event.clientEventId);
  events.push(event);

  if (events.length > OUTBOX_LIMIT) {
    const dropped = events.length - OUTBOX_LIMIT;
    console.warn(
      `[outbox] ${dropped} unsent event${dropped === 1 ? '' : 's'} dropped: the queue is ` +
        `full at ${OUTBOX_LIMIT}. That progress is gone.`,
    );
    events.splice(0, dropped);
  }

  await write(userId, inOrder(events));
}

/**
 * Sends everything waiting, oldest first, and stops at the first thing that says to.
 *
 * Three ways an event can fail, and they are not the same:
 *
 *   · **unreachable** — the queue is left exactly as it was and the flush stops. Nothing
 *     is lost; there is simply no server to tell.
 *   · **out of hearts** — the player was out at that point in the run, so nothing queued
 *     behind it happened either. Those events are dropped rather than replayed against a
 *     state that has moved on, and the caller says so out loud.
 *   · **anything else** — a lesson already completed, a question the answer key has never
 *     heard of. Replaying those would fail identically forever, so they are dropped one
 *     at a time and the flush carries on.
 */
export function flush(userId: string): Promise<FlushResult> {
  return serial(() => send(userId));
}

async function send(userId: string): Promise<FlushResult> {
  const result = empty();
  const queue = await pending(userId);
  if (queue.length === 0) return result;

  let index = 0;

  for (; index < queue.length; index++) {
    const event = queue[index];

    try {
      if (event.kind === 'answer') {
        result.answer = await submitAnswer({
          ...event.payload,
          clientEventId: event.clientEventId,
          occurredAt: new Date(event.occurredAt),
        });
      } else {
        result.state = await completeLesson({
          ...event.payload,
          clientEventId: event.clientEventId,
          occurredAt: new Date(event.occurredAt),
        });
      }
      result.sent++;
    } catch (error) {
      const code = serverErrorCode(error);

      if (code === 'UNREACHABLE') {
        result.offline = true;
        break;
      }

      if (code === 'OUT_OF_HEARTS') {
        result.outOfHearts = true;
        result.dropped += queue.length - index;
        index = queue.length;
        break;
      }

      result.dropped++;
      result.refused = serverErrorMessage(error);
    }
  }

  // Only an unreachable server leaves anything behind, and it leaves the event it
  // stopped on: everything else was either sent or refused for good.
  const remaining = result.offline ? queue.slice(index) : [];
  result.remaining = remaining.length;
  await write(userId, remaining);

  return result;
}

function isEvent(value: unknown): value is OutboxEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  if (event.kind !== 'answer' && event.kind !== 'completion') return false;
  if (typeof event.clientEventId !== 'string' || typeof event.occurredAt !== 'string') return false;
  return typeof event.payload === 'object' && event.payload !== null;
}
