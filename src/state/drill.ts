/**
 * The drill's writes.
 *
 * The UI never waits on these: `pick` renders its feedback from the local course the
 * instant it is tapped, and what happens here catches up afterwards. What the server
 * sends back is authoritative all the same — its hearts and its `next_heart_at` replace
 * whatever the optimistic move assumed, so a client that guessed wrong corrects itself
 * within a round trip (§3 rule 3).
 *
 * Kept out of `store.tsx` so it can be driven straight from a test with a faked server,
 * which is what `store.test.ts` does.
 */

import * as Crypto from 'expo-crypto';

import type { LessonRef } from '../content/progress';
import {
  completeLesson,
  serverErrorCode,
  serverErrorMessage,
  submitAnswer,
  tzOffsetMin,
  type AnswerOutcome,
  type PlayerState,
} from '../server/client';

/** What the drill tells the store. The store folds these into its own `Action` union. */
export type DrillAction =
  | { type: 'answerRecorded'; outcome: AnswerOutcome }
  | { type: 'answerFailed'; message: string }
  | { type: 'outOfHearts' }
  | { type: 'completing' }
  | { type: 'lessonCompleted'; state: PlayerState; clockOffset: number }
  | { type: 'completeFailed'; message: string };

export type DrillDispatch = (action: DrillAction) => void;

/**
 * One writer at a time, in the order the player played.
 *
 * `complete_lesson` counts the answer rows it is summarising and refuses a lesson that
 * has none, so the completion must not overtake the answers it belongs to. The server
 * takes a row lock per player anyway, so nothing is lost by queueing here — and the
 * ordering is the same one P16's outbox will need.
 */
let queue: Promise<unknown> = Promise.resolve();

function serial<T>(work: () => Promise<T>): Promise<T> {
  // both arms run `work`: one failed write must not wedge every write behind it
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Set when the server refuses an answer for want of a heart.
 *
 * The "Finish the hand" button appears the moment an answer is picked, so a completion
 * can be queued behind an answer that has not come back yet. If that answer is refused,
 * the completion must not go: the lesson is unfinished by definition, and
 * `complete_lesson` would record it happily — it asks only whether the lesson has any
 * answer rows, and the questions before this one supply those.
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
 * Sends what was picked — never whether it was right, which is the answer key's to say.
 *
 * `clientEventId` is what makes a replay a no-op rather than a second spent heart (§3
 * rule 9); it is generated here today and will come from the outbox in P16.
 */
export async function recordAnswer(
  dispatch: DrillDispatch,
  answer: {
    ref: LessonRef;
    questionIndex: number;
    optionId: string;
    clockOffset: number;
    clientEventId?: string;
  },
): Promise<void> {
  const clientEventId = answer.clientEventId ?? Crypto.randomUUID();
  const occurredAt = serverNow(answer.clockOffset);

  try {
    const outcome = await serial(async () => {
      try {
        return await submitAnswer({
          lessonId: answer.ref.lessonId,
          questionIndex: answer.questionIndex,
          chosenOptionId: answer.optionId,
          clientEventId,
          occurredAt,
          tzOffsetMin: tzOffsetMin(),
        });
      } catch (error) {
        // inside the queued work, so the flag is set before whatever is queued behind
        // this runs. Setting it from the outer catch below would be a microtask late,
        // and the completion could slip past.
        if (serverErrorCode(error) === 'OUT_OF_HEARTS') heartsRanOut = true;
        throw error;
      }
    });
    dispatch({ type: 'answerRecorded', outcome });
  } catch (error) {
    // Out of hearts is not a failed write, it is an answer: the drill ends here and the
    // lesson stays unfinished, so it can be replayed from the start (§6, "Zero hearts").
    if (serverErrorCode(error) === 'OUT_OF_HEARTS') dispatch({ type: 'outOfHearts' });
    else dispatch({ type: 'answerFailed', message: serverErrorMessage(error) });
  }
}

/**
 * Finishes the lesson. The reply is a whole `get_state()`, so the streak, the XP derived
 * from the answers just given and the completed list all arrive together — the client
 * never adds the lesson to that list itself.
 */
export async function finishLesson(
  dispatch: DrillDispatch,
  lesson: { ref: LessonRef; clockOffset: number; clientEventId?: string },
): Promise<void> {
  const clientEventId = lesson.clientEventId ?? Crypto.randomUUID();
  const occurredAt = serverNow(lesson.clockOffset);

  try {
    // inside the queue, not before it: whether the run survived is only known once the
    // answers ahead of this have had their reply
    const state = await serial(async () =>
      heartsRanOut
        ? null
        : completeLesson({
            lessonId: lesson.ref.lessonId,
            chapterId: lesson.ref.chapterId,
            clientEventId,
            occurredAt,
            tzOffsetMin: tzOffsetMin(),
          }),
    );

    // the out-of-hearts ending already owns the screen, and owns it correctly
    if (!state) return;

    dispatch({
      type: 'lessonCompleted',
      state,
      clockOffset: Date.parse(state.serverNow) - Date.now(),
    });
  } catch (error) {
    // A completion that was refused is said out loud on the done card. Silently not
    // saving a lesson the player just played is the one thing this must not do.
    dispatch({ type: 'completeFailed', message: serverErrorMessage(error) });
  }
}
