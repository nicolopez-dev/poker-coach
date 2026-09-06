/**
 * The drill's writes.
 *
 * Nothing here calls the server directly any more: an answer is put in the outbox and
 * the outbox is flushed. Online that is a round trip with an extra disk write; offline
 * it is the whole feature, and there is no second code path that only runs when
 * something is broken.
 *
 * The UI never waits on any of it. `pick` renders its feedback from the local course the
 * instant it is tapped, and what the server says catches up: its hearts and its
 * `next_heart_at` replace whatever the optimistic move assumed (§3 rule 3).
 *
 * Kept out of `store.tsx` so it can be driven straight from a test with a faked server,
 * which is what `store.test.ts` does.
 */

import * as Crypto from 'expo-crypto';

import type { LessonRef } from '../content/progress';
import { tzOffsetMin, type AnswerOutcome, type PlayerState } from '../server/client';
import { enqueue, flush, pending, type FlushResult } from '../server/outbox';

/** What the drill and the sync tell the store. */
export type DrillAction =
  | { type: 'answerRecorded'; outcome: AnswerOutcome }
  | { type: 'outOfHearts' }
  | { type: 'completing' }
  | { type: 'lessonDone'; queued: boolean }
  | { type: 'lessonCompleted'; state: PlayerState; clockOffset: number }
  | { type: 'completeFailed'; message: string }
  | { type: 'connection'; online: boolean }
  | { type: 'unsaved'; count: number };

export type DrillDispatch = (action: DrillAction) => void;

/**
 * Set when the server refuses an answer for want of a heart.
 *
 * The button to finish appears the moment an answer is picked, so a completion can be
 * queued behind an answer whose reply has not come back. If that answer was refused, the
 * completion must never be queued at all: `complete_lesson` asks only whether the lesson
 * has any answer rows, and the questions before this one supply them. The outbox applies
 * the same rule to a whole queue; this covers the live race, where the two are one flush
 * apart.
 */
let heartsRanOut = false;

/** Opening a lesson clears it. The flag belongs to the run, not to the app. */
export function beginRun(): void {
  heartsRanOut = false;
}

/**
 * The instant to send. Derived from the offset captured at hydration rather than the
 * device clock (§3 rule 8), so a wound-forward phone cannot backdate or postdate a
 * streak; the server clamps it to the last seven days regardless.
 */
function serverNow(clockOffset: number): Date {
  return new Date(Date.now() + clockOffset);
}

/**
 * Sends whatever is waiting and tells the store what came back.
 *
 * Called after every write, after a successful hydrate, on foreground and on reconnect —
 * a flush with an empty queue costs one disk read, so there is no reason to be clever
 * about when to try.
 */
export async function syncOutbox(
  dispatch: DrillDispatch,
  userId: string | null,
): Promise<FlushResult | null> {
  if (!userId) return null;

  const result = await flush(userId);
  dispatch({ type: 'connection', online: !result.offline });

  // A completion answers with a whole state; fold it in the way hydration does, so the
  // streak, the XP and the completed list all move together.
  if (result.state) {
    dispatch({
      type: 'lessonCompleted',
      state: result.state,
      clockOffset: Date.parse(result.state.serverNow) - Date.now(),
    });
  } else if (result.answer) {
    dispatch({ type: 'answerRecorded', outcome: result.answer });
  }

  // Anything the server refused is gone for good, and the player is told rather than
  // shown a tick. Out of hearts is its own ending, and takes the screen.
  if (result.dropped > 0) dispatch({ type: 'unsaved', count: result.dropped });
  if (result.outOfHearts) {
    heartsRanOut = true;
    dispatch({ type: 'outOfHearts' });
  }

  return result;
}

/**
 * Queues one answer and tries to send it. The client sends what was picked, never
 * whether it was right — the answer key decides that (§3 rule 5).
 */
export async function recordAnswer(
  dispatch: DrillDispatch,
  answer: {
    userId: string | null;
    ref: LessonRef;
    questionIndex: number;
    optionId: string;
    clockOffset: number;
    clientEventId?: string;
  },
): Promise<void> {
  if (!answer.userId) return;

  const occurredAt = serverNow(answer.clockOffset);
  await enqueue(answer.userId, {
    kind: 'answer',
    clientEventId: answer.clientEventId ?? Crypto.randomUUID(),
    occurredAt: occurredAt.toISOString(),
    payload: {
      lessonId: answer.ref.lessonId,
      questionIndex: answer.questionIndex,
      chosenOptionId: answer.optionId,
      tzOffsetMin: tzOffsetMin(occurredAt),
    },
  });

  await syncOutbox(dispatch, answer.userId);
}

/**
 * Finishes the lesson: queues the completion, sends everything, and decides what the
 * done card says.
 *
 * Three endings. The server took it, and the state it replied with is already in the
 * store. Nobody could be reached, so it is queued and the lesson counts locally until a
 * flush says otherwise. Or it was refused — and that is said out loud rather than shown
 * as a tick.
 */
export async function finishLesson(
  dispatch: DrillDispatch,
  lesson: {
    userId: string | null;
    ref: LessonRef;
    clockOffset: number;
    clientEventId?: string;
  },
): Promise<void> {
  if (!lesson.userId) return;

  // the run is already over: queueing this would have the server record a lesson the
  // player never finished
  if (heartsRanOut) return;

  const clientEventId = lesson.clientEventId ?? Crypto.randomUUID();
  const occurredAt = serverNow(lesson.clockOffset);
  await enqueue(lesson.userId, {
    kind: 'completion',
    clientEventId,
    occurredAt: occurredAt.toISOString(),
    payload: {
      lessonId: lesson.ref.lessonId,
      chapterId: lesson.ref.chapterId,
      tzOffsetMin: tzOffsetMin(occurredAt),
    },
  });

  const result = await syncOutbox(dispatch, lesson.userId);

  // The run ended for want of a heart — either in this flush or in the one that was
  // already in the air when this was queued. Its screen owns what happens next.
  if (!result || result.outOfHearts || heartsRanOut) return;

  // What matters is what became of *this* event, not what this particular flush did:
  // an answer's flush, still running when the completion was queued, may have carried
  // it already, leaving this one nothing to do.
  const waiting = (await pending(lesson.userId)).some((e) => e.clientEventId === clientEventId);

  if (waiting) {
    // saved on this phone, and on its way as soon as there is a connection
    dispatch({ type: 'lessonDone', queued: true });
  } else if (result.refused && !result.state) {
    dispatch({ type: 'completeFailed', message: result.refused });
  } else {
    dispatch({ type: 'lessonDone', queued: false });
  }
}
