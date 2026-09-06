/**
 * The drill against a faked server.
 *
 * The fake stands in for `submit_answer` and `complete_lesson` with the two behaviours
 * that matter: it decides correctness from its *own* answer key, so a client that
 * disagrees can be seen losing the argument, and it is idempotent on
 * `client_event_id`, so a replay cannot spend a second heart (§3 rules 5 and 9).
 *
 * The reducer is driven directly — no React — with `recordAnswer` and `finishLesson`
 * dispatching into it exactly as the provider has them do.
 */

// No client, and no environment to build one from: every server call is faked below.
jest.mock('../auth/supabase', () => ({ supabase: { auth: {} } }));

// The reducer is the subject, not the provider — so the session layer stays out, along
// with the native modules (Google sign-in, secure storage) it would drag in.
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedOut', user: null }) }));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { COURSE } from '../content/course';
import { isDrill } from '../content/progress';
import { XP_PER_ANSWER } from '../content/types';
import { liveStreak, streakAtRisk } from '../lib/streak';
import { ServerError, type AnswerOutcome, type PlayerState } from '../server/client';
import { clearOutbox, pending } from '../server/outbox';
import { beginRun, finishLesson, recordAnswer, syncOutbox } from './drill';
import { initialState, reducer } from './store';

const CHAPTER = COURSE[0];
const LESSON = CHAPTER.lessons[0];
if (!isDrill(LESSON)) throw new Error('the first lesson is expected to be a drill');

const REF = { chapterId: CHAPTER.id, lessonId: LESSON.id };
const QUESTION = LESSON.questions[0];
/** The option the local course calls correct, and one it does not. */
const RIGHT = QUESTION.correct;
const WRONG = QUESTION.options.find((o) => o.id !== RIGHT)!.id;

const PLAYER = '99999999-9999-4999-8999-999999999999';
const NOW = '2026-09-05T12:00:00.000Z';
const NEXT_HEART = '2026-09-05T18:00:00.000Z';
const SERVER_NOW = '2026-09-05T14:00:00.000Z';

/** A server that holds the hearts, the answer key and every event id it has seen. */
function fakeServer({ hearts = 5, key = RIGHT }: { hearts?: number; key?: string } = {}) {
  const seen = new Map<string, AnswerOutcome>();
  const answered: { lessonId: string; correct: boolean }[] = [];
  const state = { hearts, calls: 0, completions: 0 };

  return {
    state,
    answered,
    async submitAnswer(input: { chosenOptionId: string; clientEventId: string; lessonId: string }) {
      state.calls++;
      // the real function keys its idempotency on this, so a missing one would make
      // every answer look like a replay of the last
      if (!input.clientEventId) throw new Error('submit_answer needs a client_event_id');
      const replay = seen.get(input.clientEventId);
      if (replay) return replay;
      if (state.hearts === 0) throw new ServerError('OUT_OF_HEARTS', 'out of hearts');

      const correct = input.chosenOptionId === key;
      if (!correct) state.hearts--;

      const outcome: AnswerOutcome = {
        correct,
        hearts: state.hearts,
        nextHeartAt: state.hearts < 5 ? NEXT_HEART : null,
      };
      seen.set(input.clientEventId, outcome);
      answered.push({ lessonId: input.lessonId, correct });
      return outcome;
    },
    async completeLesson(input: { lessonId: string }): Promise<PlayerState> {
      state.completions++;
      // exactly what the real function checks: that the lesson has answer rows at all.
      // It knows nothing about hearts, which is why the client must not send this after
      // an answer was refused for want of one.
      if (!answered.some((a) => a.lessonId === input.lessonId)) {
        throw new ServerError('NO_ANSWERS', 'that hand was never played');
      }
      return {
        hearts: state.hearts,
        nextHeartAt: state.hearts < 5 ? NEXT_HEART : null,
        streak: 12,
        streakAtRisk: false,
        streakExpiresAt: null,
        longestStreak: 41,
        storedStreak: 12,
        streakDay: '2026-09-05',
        xp: answered.filter((a) => a.correct).length * XP_PER_ANSWER,
        accuracy: 1,
        completedLessons: [input.lessonId],
        serverNow: SERVER_NOW,
      };
    },
  };
}

/** `mock`-prefixed so the factory below may reach it — babel hoists that above imports. */
let mockServer: ReturnType<typeof fakeServer>;

// Only the two writes are faked. `ServerError` and the error-to-copy mapping stay real,
// so the done card's message in these tests is the one a player would actually read.
jest.mock('../server/client', () => ({
  ...(jest.requireActual('../server/client') as object),
  submitAnswer: (input: { chosenOptionId: string; clientEventId: string; lessonId: string }) =>
    mockServer.submitAnswer(input),
  completeLesson: (input: { lessonId: string }) => mockServer.completeLesson(input),
}));

/** The reducer with a dispatch, which is all the provider adds to it. */
function store(hearts = 5) {
  let state = reducer(
    { ...initialState, hearts, hydrated: true },
    { type: 'startLesson', ref: REF },
  );
  return {
    get state() {
      return state;
    },
    dispatch: (action: Parameters<typeof reducer>[1]) => {
      state = reducer(state, action);
    },
  };
}

/**
 * Ids are passed explicitly rather than left to `Crypto.randomUUID()`, which has no
 * implementation under jest — and a missing id would quietly make every answer look
 * like a replay of the one before it.
 */
let events = 0;

const finish = (s: ReturnType<typeof store>, clientEventId = `finish-${++events}`) =>
  finishLesson(s.dispatch, { userId: PLAYER, ref: REF, clockOffset: 0, clientEventId });

const answer = (
  s: ReturnType<typeof store>,
  optionId: string,
  clientEventId = `event-${++events}`,
) =>
  recordAnswer(s.dispatch, {
    userId: PLAYER,
    ref: REF,
    questionIndex: 0,
    optionId,
    clockOffset: 0,
    clientEventId,
  });

beforeEach(async () => {
  mockServer = fakeServer();
  beginRun();
  await clearOutbox(PLAYER);
});

describe('answering', () => {
  it('shows the verdict before the server has said anything', () => {
    const s = store();
    s.dispatch({ type: 'pick', id: RIGHT, at: NOW });

    expect(s.state.chosen).toBe(RIGHT);
    expect(s.state.gained).toBe(XP_PER_ANSWER);
    expect(mockServer.state.calls).toBe(0);
  });

  it('keeps a correct answer’s hearts, and counts no XP locally', async () => {
    const s = store();
    s.dispatch({ type: 'pick', id: RIGHT, at: NOW });
    await answer(s, RIGHT);

    expect(s.state.hearts).toBe(5);
    expect(s.state.nextHeartAt).toBeNull();
    // the "+N XP" tally is local; the total is derived from `answers` server-side
    expect(s.state.gained).toBe(XP_PER_ANSWER);
    expect(s.state.xp).toBe(0);
  });

  it('spends a heart on a wrong answer, optimistically and then for real', async () => {
    const s = store();
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    expect(s.state.hearts).toBe(4);

    await answer(s, WRONG);

    expect(mockServer.state.hearts).toBe(4);
    expect(s.state.hearts).toBe(4);
    expect(s.state.nextHeartAt).toBe(NEXT_HEART);
    expect(s.state.gained).toBe(0);
  });

  it('adopts the server’s verdict when it disagrees with the optimistic one', async () => {
    // the answer key has moved on under a stale client: what the course calls right,
    // the server calls wrong
    mockServer = fakeServer({ key: WRONG });

    const s = store();
    s.dispatch({ type: 'pick', id: RIGHT, at: NOW });
    expect(s.state.hearts).toBe(5); // optimistically, nothing was spent

    await answer(s, RIGHT);

    expect(s.state.hearts).toBe(4);
    expect(s.state.nextHeartAt).toBe(NEXT_HEART);
  });

  it('does not spend twice when the same event id is sent again', async () => {
    const s = store();
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    await answer(s, WRONG, 'e5d0f2a1-0000-4000-8000-000000000001');
    await answer(s, WRONG, 'e5d0f2a1-0000-4000-8000-000000000001');

    expect(mockServer.state.calls).toBe(2);
    expect(mockServer.state.hearts).toBe(4);
    expect(s.state.hearts).toBe(4);
  });

  it('ends the drill when the server says there was no heart to spend', async () => {
    mockServer = fakeServer({ hearts: 0 });

    const s = store(1);
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    await answer(s, WRONG);

    expect(s.state.outOfHearts).toBe(true);
    expect(s.state.hearts).toBe(0);
    expect(s.state.drillDone).toBe(false);
    expect(s.state.completedLessons).toEqual([]);
  });

  // Offline is not a failure any more: the answer is kept and the drill carries on. The
  // heart was spent by the same arithmetic the server would have used, so the two agree
  // when the queue finally lands.
  it('keeps the answer, and the play, when there is no server to send it to', async () => {
    mockServer = fakeServer();
    mockServer.submitAnswer = async () => {
      throw new ServerError('UNREACHABLE', 'whatever the network said');
    };

    const s = store();
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    await answer(s, WRONG, 'queued-1');

    expect(s.state.hearts).toBe(4);
    expect(s.state.offline).toBe(true);
    expect(s.state.outOfHearts).toBe(false);
    expect(s.state.unsaved).toBe(0);

    // and it is still there, waiting
    expect((await pending(PLAYER)).map((e) => e.clientEventId)).toEqual(['queued-1']);
  });

  it('sends what was waiting once the server is back', async () => {
    const offline = fakeServer();
    offline.submitAnswer = async () => {
      throw new ServerError('UNREACHABLE', 'no server');
    };
    mockServer = offline;

    const s = store();
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    await answer(s, WRONG, 'queued-2');
    expect(s.state.offline).toBe(true);

    // the connection comes back, and nothing had to be replayed by hand
    mockServer = fakeServer();
    await syncOutbox(s.dispatch, PLAYER);

    expect(mockServer.state.hearts).toBe(4);
    expect(s.state.offline).toBe(false);
    expect(await pending(PLAYER)).toEqual([]);
  });
});

describe('finishing', () => {
  it('adds the lesson only once the server has recorded it', async () => {
    const s = store();
    s.dispatch({ type: 'pick', id: RIGHT, at: NOW });
    await answer(s, RIGHT);

    s.dispatch({ type: 'completing' });
    expect(s.state.completing).toBe(true);
    expect(s.state.drillDone).toBe(false);
    expect(s.state.completedLessons).toEqual([]);

    await finish(s);

    expect(s.state.drillDone).toBe(true);
    expect(s.state.completing).toBe(false);
    expect(s.state.completedLessons).toEqual([LESSON.id]);
    // the whole state comes back with the completion, XP included
    expect(s.state.xp).toBe(XP_PER_ANSWER);
    expect(s.state.streak).toBe(12);
  });

  // The button to finish appears as soon as an answer is picked, so a player on a slow
  // connection can tap it while that answer is still in the air. If the answer comes
  // back refused, the completion queued behind it must never be sent: `complete_lesson`
  // asks only whether the lesson has answer rows — the earlier questions have them — so
  // the server would record a lesson the player did not finish, and advance the streak.
  it('does not finish a lesson whose last answer ran out of hearts', async () => {
    mockServer = fakeServer({ hearts: 1 });
    beginRun();

    const s = store(1);

    // question one is answered wrong, taking the last heart
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    await answer(s, WRONG);
    expect(mockServer.state.hearts).toBe(0);

    // the last one is picked and finished in the same breath, neither awaited
    s.dispatch({ type: 'pick', id: WRONG, at: NOW });
    const answering = answer(s, WRONG);
    s.dispatch({ type: 'completing' });
    const finishing = finishLesson(s.dispatch, { userId: PLAYER, ref: REF, clockOffset: 0, clientEventId: "finish-1" });
    await Promise.all([answering, finishing]);

    expect(mockServer.state.completions).toBe(0);
    expect(s.state.outOfHearts).toBe(true);
    expect(s.state.drillDone).toBe(false);
    expect(s.state.completedLessons).toEqual([]);
  });

  it('says why on the done card when the completion is refused', async () => {
    const s = store();

    s.dispatch({ type: 'completing' });
    await finish(s);

    expect(s.state.drillDone).toBe(true);
    expect(s.state.completionError).toBe('That hand was never played, so there is nothing to save.');
    expect(s.state.completedLessons).toEqual([]);
  });

  it('never lets the last question finish the drill on its own', () => {
    const s = store();
    let state = s.state;
    for (let i = 0; i < LESSON.questions.length + 2; i++) {
      state = reducer(state, { type: 'nextQuestion' });
    }

    expect(state.qi).toBe(LESSON.questions.length - 1);
    expect(state.drillDone).toBe(false);
  });
});

describe('the streak', () => {
  /** A state the server would send, with the streak resolved as `live_streak` resolves it. */
  const served = (streakDay: string | null, stored: number, today: string): PlayerState => ({
    hearts: 5,
    nextHeartAt: null,
    streak: streakDay === null ? 0 : liveStreak(stored, streakDay, today),
    streakAtRisk: streakAtRisk(streakDay, today),
    streakExpiresAt: `${today}T22:00:00.000Z`,
    longestStreak: 41,
    storedStreak: stored,
    streakDay,
    xp: 0,
    accuracy: 1,
    completedLessons: [],
    serverNow: `${today}T09:00:00.000Z`,
  });

  const hydrate = (state: PlayerState) =>
    reducer(initialState, { type: 'hydrate', state, clockOffset: 0, source: 'server' });

  it('shows zero for a lapsed run, and keeps the number that ended', () => {
    const state = hydrate(served('2026-09-01', 40, '2026-09-06'));

    expect(state.streak).toBe(0);
    expect(state.streakAtRisk).toBe(false);
    // nothing was written to get there: the stored count is still forty, which is what
    // the lapse card has to show
    expect(state.storedStreak).toBe(40);
    expect(state.longestStreak).toBe(41);
    expect(state.streakDay).toBe('2026-09-01');
  });

  it('sets the flag for a run last extended yesterday', () => {
    const state = hydrate(served('2026-09-05', 13, '2026-09-06'));

    expect(state.streak).toBe(13);
    expect(state.streakAtRisk).toBe(true);
    expect(state.streakExpiresAt).toBe('2026-09-06T22:00:00.000Z');
  });

  it('is neither at risk nor lapsed on the day it was played', () => {
    const state = hydrate(served('2026-09-06', 13, '2026-09-06'));

    expect(state.streak).toBe(13);
    expect(state.streakAtRisk).toBe(false);
  });

  it('has nothing to show a player who has never had one', () => {
    const state = hydrate(served(null, 0, '2026-09-06'));

    expect(state.streak).toBe(0);
    expect(state.storedStreak).toBe(0);
    expect(state.streakDay).toBeNull();
  });

  // The case the whole prompt exists for: an app left open while the days go by. Nothing
  // is fetched here — the recompute is local, and the stored count never moves.
  it('walks alive → at risk → lapsed as local midnight passes', () => {
    let state = hydrate(served('2026-09-06', 13, '2026-09-06'));
    expect(state.streak).toBe(13);
    expect(state.streakAtRisk).toBe(false);

    const midnight = (day: string) => ({
      type: 'recomputeStreak' as const,
      today: day,
      expiresAt: `${day}T22:00:00.000Z`,
    });

    state = reducer(state, midnight('2026-09-07'));
    expect(state.streak).toBe(13);
    expect(state.streakAtRisk).toBe(true);
    expect(state.streakExpiresAt).toBe('2026-09-07T22:00:00.000Z');

    state = reducer(state, midnight('2026-09-08'));
    expect(state.streak).toBe(0);
    expect(state.streakAtRisk).toBe(false);
    expect(state.storedStreak).toBe(13);
    expect(state.streakDay).toBe('2026-09-06');
  });
});

describe('opening a lesson', () => {
  it('refuses at zero hearts, and shows the countdown instead', () => {
    const empty = { ...initialState, hydrated: true, hearts: 0 };
    const state = reducer(empty, { type: 'startLesson', ref: REF });

    expect(state.outOfHearts).toBe(true);
    expect(state.drillOpen).toBe(false);
    // the lesson is not started, so it is not half-played either
    expect(state.activeLesson).toBeNull();
  });

  it('opens on the last heart', () => {
    const last = { ...initialState, hydrated: true, hearts: 1 };
    const state = reducer(last, { type: 'startLesson', ref: REF });

    expect(state.drillOpen).toBe(true);
    expect(state.outOfHearts).toBe(false);
  });

  it('does not refuse on a zero it has not heard from the server yet', () => {
    // the store starts on zero hearts; an unhydrated one is ignorance, not an empty pile
    const state = reducer(initialState, { type: 'startLesson', ref: REF });

    expect(state.drillOpen).toBe(true);
    expect(state.outOfHearts).toBe(false);
  });

  it('closes the drill when the run ends, so the countdown can take the screen', () => {
    const s = store();
    s.dispatch({ type: 'outOfHearts' });

    expect(s.state.drillOpen).toBe(false);
    expect(s.state.outOfHearts).toBe(true);
    expect(s.state.hearts).toBe(0);
  });

  it('lets go of what could not be saved once the player moves on', () => {
    const s = store();
    s.dispatch({ type: 'unsaved', count: 2 });
    expect(s.state.unsaved).toBe(2);

    // starting the next lesson is the acknowledgement; there is nothing to dismiss
    s.dispatch({ type: 'startLesson', ref: REF });
    expect(s.state.unsaved).toBe(0);
  });

  it('leaves the out-of-hearts screen for Home', () => {
    const s = store();
    s.dispatch({ type: 'outOfHearts' });
    s.dispatch({ type: 'dismissHearts' });

    expect(s.state.outOfHearts).toBe(false);
    expect(s.state.tab).toBe('home');
  });
});
