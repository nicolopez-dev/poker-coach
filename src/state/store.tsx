import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { COURSE } from '../content/course';
import {
  courseProgress,
  findLesson,
  isDrill,
  nextLesson,
  type ChapterProgress,
  type LessonRef,
} from '../content/progress';
import { XP_PER_ANSWER, type Question } from '../content/types';
import {
  DEFAULT_COLORS,
  MAX_CHIP_COUNT,
  MAX_CHIP_VALUE,
  MAX_COLORS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_COLORS,
  MIN_PLAYERS,
  SPARE_COLORS,
} from '../data/chipCase';
import { POINTS_PER_UNIT } from '../lib/balance';
import { deal, type ChipColor, type DealResult } from '../lib/chips';
import { clamp, digits } from '../lib/num';
import { NAME_MAX_LENGTH } from '../lib/names';
import type { PlayerState } from '../server/client';
import { fetchProfile, type Profile } from '../server/profile';
import { useHydrate, type HydrateAction } from '../server/useHydrate';
import { beginRun, finishLesson, recordAnswer, type DrillAction } from './drill';

export type Tab = 'home' | 'path' | 'chips' | 'you';

export type State = {
  /** the player's own profile, hydrated from the server on sign-in */
  displayName: string | null;
  avatarId: string | null;

  tab: Tab;

  /**
   * The economy, as the server last reported it. None of these are written locally
   * except optimistically — hearts, XP and the streak are server-derived (§3 rule 3).
   */
  hearts: number;
  xp: number;
  streak: number;
  /** when the next heart lands, or null at full; ISO, and read against `clockOffset` */
  nextHeartAt: string | null;

  /**
   * `server_now - Date.now()` as of the last hydrate. Every countdown adds this to the
   * device clock, so changing the phone's clock does nothing to hearts (§3 rule 8).
   */
  clockOffset: number;
  /**
   * Whether the numbers above are this player's own — from the cache or from the server.
   * Until then the screens show skeletons: a slow network must not flash "0 day streak"
   * at someone forty days in. It does *not* mean a sync has finished; `syncing` does.
   */
  hydrated: boolean;
  syncing: boolean;
  syncError: string | null;

  /** lesson ids the player has finished */
  completedLessons: string[];
  /** the lesson the overlay is running, if any */
  activeLesson: LessonRef | null;

  drillOpen: boolean;
  drillDone: boolean;
  /** the completion is in flight — the last question's button says so and locks */
  completing: boolean;
  /** why the completion was refused, said out loud on the done card rather than swallowed */
  completionError: string | null;
  /** the server ended the drill: the lesson is unfinished and replayable (§6) */
  outOfHearts: boolean;
  /** current question index */
  qi: number;
  /** the option picked for the current question, or null */
  chosen: string | null;
  /**
   * XP earned in this drill, counted locally for the "+N XP" on the done card. The
   * total is not: it is derived from `answers` server-side and arrives with the state.
   */
  gained: number;

  players: number;
  /** entry in points (units × 100) */
  buyIn: number;
  autoValues: boolean;
  colors: ChipColor[];
  result: DealResult | null;

  /** end-of-game points per seat */
  ends: number[];
  /** seat names, stored in full */
  names: string[];
  /** which seat name has focus, so it shows unabbreviated */
  editingName: number | null;

  gamesOpen: boolean;

  /** the verify-email strip is dismissible for the session; `reset` brings it back */
  verifyDismissed: boolean;
};

/** Exported for `store.test.ts`, which drives the reducer without mounting React. */
export const initialState: State = {
  displayName: null,
  avatarId: null,

  tab: 'home',

  // empty, not sampled: every one of these arrives from `get_state()`
  hearts: 0,
  xp: 0,
  streak: 0,
  nextHeartAt: null,

  clockOffset: 0,
  hydrated: false,
  syncing: false,
  syncError: null,

  completedLessons: [],
  activeLesson: null,

  drillOpen: false,
  drillDone: false,
  completing: false,
  completionError: null,
  outOfHearts: false,
  qi: 0,
  chosen: null,
  gained: 0,

  players: 6,
  buyIn: 500,
  autoValues: true,
  colors: DEFAULT_COLORS,
  result: null,

  ends: [],
  names: [],
  editingName: null,

  gamesOpen: false,

  verifyDismissed: false,
};

type Action =
  | HydrateAction
  | DrillAction
  | { type: 'reset' }
  | { type: 'setProfile'; profile: Profile }
  | { type: 'go'; tab: Tab }
  | { type: 'startLesson'; ref: LessonRef | undefined }
  | { type: 'closeDrill' }
  | { type: 'pick'; id: string }
  | { type: 'nextQuestion' }
  | { type: 'stepPlayers'; delta: number }
  | { type: 'setBet'; value: string }
  | { type: 'setAutoValues'; auto: boolean }
  | { type: 'patchColor'; index: number; patch: Partial<ChipColor> }
  | { type: 'addColor' }
  | { type: 'removeColor'; index: number }
  | { type: 'deal' }
  | { type: 'setEnd'; index: number; value: string }
  | { type: 'setName'; index: number; value: string }
  | { type: 'setEditingName'; index: number | null }
  | { type: 'toggleGames' }
  | { type: 'dismissHearts' }
  | { type: 'dismissVerify' }
  | { type: 'loadGame'; players: number; buyIn: number };

/** Any edit to the case invalidates the deal — the user has to deal again. */
const clearResult = { result: null } as const;

/** Questions of the lesson currently running, or none for other lesson kinds. */
function activeQuestions(state: State): Question[] {
  const lesson = findLesson(COURSE, state.activeLesson);
  return isDrill(lesson) ? lesson.questions : [];
}

/**
 * A state the server sent, folded in — the one place `get_state()` lands, whether it
 * came from hydration or from finishing a lesson. The completed list is the server's
 * too: the client never appends to it.
 */
function fromServer(state: State, player: PlayerState, clockOffset: number): State {
  return {
    ...state,
    hearts: player.hearts,
    nextHeartAt: player.nextHeartAt,
    streak: player.streak,
    xp: player.xp,
    completedLessons: player.completedLessons,
    clockOffset,
    hydrated: true,
    syncing: false,
    syncError: null,
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initialState;

    case 'setProfile':
      return {
        ...state,
        displayName: action.profile.displayName,
        avatarId: action.profile.avatarId,
      };

    case 'syncStart':
      return { ...state, syncing: true, syncError: null };

    case 'syncFailed':
      return { ...state, syncing: false, syncError: action.message };

    // The server's answer replaces whatever was on screen, cached or optimistic. The
    // cache only ever fills a gap: it never carries a clock offset, and it never clears
    // an error the server has not answered.
    case 'hydrate': {
      const served = action.source === 'server';
      const next = fromServer(
        state,
        action.state,
        served ? action.clockOffset : state.clockOffset,
      );
      return served ? next : { ...next, syncing: state.syncing, syncError: state.syncError };
    }

    case 'go':
      return { ...state, tab: action.tab };

    case 'startLesson':
      if (!action.ref) return state;
      // No heart, no hand. The lesson is left where it is — it is not started, so it is
      // not half-finished either — and the countdown takes the screen instead. Only
      // once the count is known: an unhydrated zero is ignorance, not an empty pile.
      if (state.hydrated && state.hearts === 0) return { ...state, outOfHearts: true };
      return {
        ...state,
        activeLesson: action.ref,
        drillOpen: true,
        qi: 0,
        chosen: null,
        drillDone: false,
        completing: false,
        completionError: null,
        outOfHearts: false,
        gained: 0,
      };

    case 'closeDrill':
      return { ...state, drillOpen: false, outOfHearts: false };

    // Optimistic, and deliberately so: the feedback card must not wait on a round trip.
    // Correctness for *rendering* comes from the local course; correctness for the
    // record is decided by the answer key on the server, and `answerRecorded` below is
    // what adopts it. XP is not touched — it is derived from `answers`, never counted
    // here; only `gained`, which is this drill's own tally, moves.
    case 'pick': {
      if (state.chosen) return state;
      const question = activeQuestions(state)[state.qi];
      const right = !!question && action.id === question.correct;
      return {
        ...state,
        chosen: action.id,
        hearts: right ? state.hearts : Math.max(0, state.hearts - 1),
        gained: right ? state.gained + XP_PER_ANSWER : state.gained,
      };
    }

    // The server's count wins outright. Adopting it every time rather than only on a
    // disagreement is what makes a replayed event a no-op: the reply to the second call
    // carries the same hearts as the first, so nothing is spent twice.
    case 'answerRecorded':
      return {
        ...state,
        hearts: action.outcome.hearts,
        nextHeartAt: action.outcome.nextHeartAt,
        syncError: null,
      };

    // The answer did not reach the server. The optimistic state stands — P16 queues the
    // write and replays it — and the reason is kept for the offline indicator.
    case 'answerFailed':
      return { ...state, syncError: action.message };

    // No heart to spend: the drill ends here, the lesson is not completed, and it can be
    // played again from the start once one returns. The overlay closes and the
    // out-of-hearts screen takes over.
    case 'outOfHearts':
      return {
        ...state,
        hearts: 0,
        outOfHearts: true,
        drillOpen: false,
        drillDone: false,
        completing: false,
      };

    case 'dismissHearts':
      return { ...state, outOfHearts: false, tab: 'home' };

    // Advancing only. The last question does not end the drill by itself any more — the
    // done card waits on `complete_lesson`, so that a lesson the server refused is never
    // shown as finished.
    case 'nextQuestion': {
      const questions = activeQuestions(state);
      if (state.qi >= questions.length - 1) return state;
      return { ...state, qi: state.qi + 1, chosen: null };
    }

    case 'completing':
      return { ...state, completing: true, completionError: null };

    // The reply is a whole `get_state()`: the streak, the XP the answers just earned and
    // the completed list all arrive together, so the lesson joins that list because the
    // server put it there.
    case 'lessonCompleted':
      return {
        ...fromServer(state, action.state, action.clockOffset),
        completing: false,
        drillDone: true,
        completionError: null,
        chosen: null,
      };

    case 'completeFailed':
      return {
        ...state,
        completing: false,
        drillDone: true,
        completionError: action.message,
        chosen: null,
      };

    case 'stepPlayers':
      return {
        ...state,
        players: clamp(state.players + action.delta, MIN_PLAYERS, MAX_PLAYERS),
        ...clearResult,
      };

    case 'setBet':
      return {
        ...state,
        buyIn: Math.max(1, digits(action.value, 1000)) * POINTS_PER_UNIT,
        ...clearResult,
      };

    case 'setAutoValues':
      return { ...state, autoValues: action.auto, ...clearResult };

    case 'patchColor':
      return {
        ...state,
        colors: state.colors.map((c, i) => (i === action.index ? { ...c, ...action.patch } : c)),
        ...clearResult,
      };

    case 'addColor': {
      if (state.colors.length >= MAX_COLORS) return state;
      const top = state.colors.reduce((m, c) => Math.max(m, c.value), 0);
      const used = state.colors.map((c) => String(c.swatch).toLowerCase());
      const pick =
        SPARE_COLORS.find((c) => used.indexOf(c.swatch) < 0) ??
        SPARE_COLORS[state.colors.length % SPARE_COLORS.length];
      return {
        ...state,
        colors: [
          ...state.colors,
          { name: pick.name, swatch: pick.swatch, count: 20, value: top * 5 || 5 },
        ],
        ...clearResult,
      };
    }

    case 'removeColor':
      if (state.colors.length <= MIN_COLORS) return state;
      return {
        ...state,
        colors: state.colors.filter((_, i) => i !== action.index),
        ...clearResult,
      };

    case 'deal': {
      const { result, colors } = deal({
        players: state.players,
        buyIn: state.buyIn,
        colors: state.colors,
        autoValues: state.autoValues,
      });
      return {
        ...state,
        colors,
        result,
        // everyone starts level, on the stack they were dealt
        ends: new Array(state.players).fill(result.val),
      };
    }

    case 'setEnd': {
      const ends = state.ends.slice();
      ends[action.index] = digits(action.value, 1000000);
      return { ...state, ends };
    }

    case 'setName': {
      const names = state.names.slice();
      names[action.index] = String(action.value).slice(0, NAME_MAX_LENGTH);
      return { ...state, names };
    }

    case 'setEditingName':
      return { ...state, editingName: action.index };

    case 'toggleGames':
      return { ...state, gamesOpen: !state.gamesOpen };

    case 'dismissVerify':
      return { ...state, verifyDismissed: true };

    case 'loadGame':
      return {
        ...state,
        players: action.players,
        buyIn: action.buyIn,
        result: null,
        ends: [],
        tab: 'chips',
      };

    default:
      return state;
  }
}

export type Store = State & {
  /**
   * Whether a lesson can be opened at all. Not knowing yet counts as yes: an unhydrated
   * zero must not lock the Path or turn the CTA into "Out of hearts" for a player who
   * has five.
   */
  canPlay: boolean;
  go: (tab: Tab) => void;
  /** open a specific lesson */
  startLesson: (ref: LessonRef | undefined) => void;
  /** open wherever the player left off */
  startNextLesson: () => void;
  closeDrill: () => void;
  pick: (id: string) => void;
  nextQuestion: () => void;
  stepPlayers: (delta: number) => void;
  setBet: (value: string) => void;
  setAutoValues: (auto: boolean) => void;
  setColorName: (index: number, value: string) => void;
  setColorSwatch: (index: number, value: string) => void;
  setColorCount: (index: number, value: string) => void;
  setColorValue: (index: number, value: string) => void;
  addColor: () => void;
  removeColor: (index: number) => void;
  dealStacks: () => void;
  setEnd: (index: number, value: string) => void;
  setName: (index: number, value: string) => void;
  setEditingName: (index: number | null) => void;
  toggleGames: () => void;
  /** leaves the out-of-hearts screen for Home */
  dismissHearts: () => void;
  /** asks the server for the state again — the countdown's end, and P15's foreground */
  refresh: () => void;
  dismissVerify: () => void;
  /** local echo of a saved profile; the write itself goes through set_profile */
  setProfile: (profile: Profile) => void;
  loadGame: (players: number, buyIn: number) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, user } = useAuth();

  // Hearts, streak, XP and the lessons behind them, from the cache and then the server.
  // Keyed on the user id so that signing in as someone else re-reads from scratch.
  const refresh = useHydrate(status === 'signedIn' ? (user?.id ?? null) : null, dispatch);

  // Signing out clears the store, and so does a session expiring underneath us — one
  // player's hearts and streak must never be the next one's. Resetting to the initial
  // state is idempotent, so a cold start that is already signed out costs nothing.
  useEffect(() => {
    if (status === 'signedOut') dispatch({ type: 'reset' });
  }, [status]);

  // The profile is the first thing hydrated from the server. A cancelled flag rather
  // than a bare promise, so signing out mid-flight cannot land the old player's name
  // in the store the new one is looking at.
  useEffect(() => {
    if (status !== 'signedIn') return;
    let live = true;

    fetchProfile().then((profile) => {
      if (live && profile) dispatch({ type: 'setProfile', profile });
    });

    return () => {
      live = false;
    };
  }, [status]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      canPlay: !state.hydrated || state.hearts > 0,
      go: (tab) => dispatch({ type: 'go', tab }),
      startLesson: (ref) => {
        beginRun();
        dispatch({ type: 'startLesson', ref });
      },
      startNextLesson: () => {
        beginRun();
        dispatch({ type: 'startLesson', ref: nextLesson(COURSE, state.completedLessons) });
      },
      closeDrill: () => dispatch({ type: 'closeDrill' }),

      // The dispatch renders the feedback; the write catches up and corrects it.
      pick: (id) => {
        if (state.chosen || !state.activeLesson) return;
        dispatch({ type: 'pick', id });
        void recordAnswer(dispatch, {
          ref: state.activeLesson,
          questionIndex: state.qi,
          optionId: id,
          clockOffset: state.clockOffset,
        });
      },

      // The last question finishes the lesson on the server before the done card shows.
      nextQuestion: () => {
        if (state.completing) return;
        if (state.qi < activeQuestions(state).length - 1) {
          dispatch({ type: 'nextQuestion' });
          return;
        }
        if (!state.activeLesson) return;
        dispatch({ type: 'completing' });
        void finishLesson(dispatch, {
          ref: state.activeLesson,
          clockOffset: state.clockOffset,
        });
      },
      stepPlayers: (delta) => dispatch({ type: 'stepPlayers', delta }),
      setBet: (value) => dispatch({ type: 'setBet', value }),
      setAutoValues: (auto) => dispatch({ type: 'setAutoValues', auto }),
      setColorName: (index, value) =>
        dispatch({ type: 'patchColor', index, patch: { name: value.slice(0, MAX_NAME_LENGTH) } }),
      setColorSwatch: (index, value) =>
        dispatch({ type: 'patchColor', index, patch: { swatch: value } }),
      setColorCount: (index, value) =>
        dispatch({ type: 'patchColor', index, patch: { count: digits(value, MAX_CHIP_COUNT) } }),
      setColorValue: (index, value) =>
        dispatch({
          type: 'patchColor',
          index,
          patch: { value: Math.max(1, digits(value, MAX_CHIP_VALUE)) },
        }),
      addColor: () => dispatch({ type: 'addColor' }),
      removeColor: (index) => dispatch({ type: 'removeColor', index }),
      dealStacks: () => dispatch({ type: 'deal' }),
      setEnd: (index, value) => dispatch({ type: 'setEnd', index, value }),
      setName: (index, value) => dispatch({ type: 'setName', index, value }),
      setEditingName: (index) => dispatch({ type: 'setEditingName', index }),
      toggleGames: () => dispatch({ type: 'toggleGames' }),
      dismissHearts: () => dispatch({ type: 'dismissHearts' }),
      refresh,
      dismissVerify: () => dispatch({ type: 'dismissVerify' }),
      setProfile: (profile) => dispatch({ type: 'setProfile', profile }),
      loadGame: (players, buyIn) => dispatch({ type: 'loadGame', players, buyIn }),
    }),
    [state, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/** The player's way through the course, derived from the lessons they finished. */
export function useProgress(): ChapterProgress[] {
  const { completedLessons } = useStore();
  return useMemo(() => courseProgress(COURSE, completedLessons), [completedLessons]);
}
