import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { COURSE, SEED_COMPLETED } from '../content/course';
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
import { fetchProfile, type Profile } from '../server/profile';

export type Tab = 'home' | 'path' | 'chips' | 'you';

export type State = {
  /** the player's own profile, hydrated from the server on sign-in */
  displayName: string | null;
  avatarId: string | null;

  tab: Tab;

  hearts: number;
  xp: number;
  streak: number;

  /** lesson ids the player has finished */
  completedLessons: string[];
  /** the lesson the overlay is running, if any */
  activeLesson: LessonRef | null;

  drillOpen: boolean;
  drillDone: boolean;
  /** current question index */
  qi: number;
  /** the option picked for the current question, or null */
  chosen: string | null;
  /** XP earned in this drill */
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

const initialState: State = {
  displayName: null,
  avatarId: null,

  tab: 'home',

  hearts: 4,
  xp: 1240,
  streak: 7,

  completedLessons: SEED_COMPLETED,
  activeLesson: null,

  drillOpen: false,
  drillDone: false,
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
  | { type: 'dismissVerify' }
  | { type: 'loadGame'; players: number; buyIn: number };

/** Any edit to the case invalidates the deal — the user has to deal again. */
const clearResult = { result: null } as const;

/** Questions of the lesson currently running, or none for other lesson kinds. */
function activeQuestions(state: State): Question[] {
  const lesson = findLesson(COURSE, state.activeLesson);
  return isDrill(lesson) ? lesson.questions : [];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initialState;

    case 'setProfile':
      return {
        ...state,
        displayName: action.profile.displayName,
        avatarId: action.profile.avatarId,
      };

    case 'go':
      return { ...state, tab: action.tab };

    case 'startLesson':
      if (!action.ref) return state;
      return {
        ...state,
        activeLesson: action.ref,
        drillOpen: true,
        qi: 0,
        chosen: null,
        drillDone: false,
        gained: 0,
      };

    case 'closeDrill':
      return { ...state, drillOpen: false };

    case 'pick': {
      if (state.chosen) return state;
      const question = activeQuestions(state)[state.qi];
      const right = !!question && action.id === question.correct;
      return {
        ...state,
        chosen: action.id,
        hearts: right ? state.hearts : Math.max(0, state.hearts - 1),
        gained: right ? state.gained + XP_PER_ANSWER : state.gained,
        xp: right ? state.xp + XP_PER_ANSWER : state.xp,
      };
    }

    case 'nextQuestion': {
      const questions = activeQuestions(state);
      if (state.qi < questions.length - 1) {
        return { ...state, qi: state.qi + 1, chosen: null };
      }
      const lessonId = state.activeLesson?.lessonId;
      return {
        ...state,
        drillDone: true,
        chosen: null,
        completedLessons:
          lessonId && !state.completedLessons.includes(lessonId)
            ? [...state.completedLessons, lessonId]
            : state.completedLessons,
      };
    }

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
  dismissVerify: () => void;
  /** local echo of a saved profile; the write itself goes through set_profile */
  setProfile: (profile: Profile) => void;
  loadGame: (players: number, buyIn: number) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status } = useAuth();

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
      go: (tab) => dispatch({ type: 'go', tab }),
      startLesson: (ref) => dispatch({ type: 'startLesson', ref }),
      startNextLesson: () =>
        dispatch({ type: 'startLesson', ref: nextLesson(COURSE, state.completedLessons) }),
      closeDrill: () => dispatch({ type: 'closeDrill' }),
      pick: (id) => dispatch({ type: 'pick', id }),
      nextQuestion: () => dispatch({ type: 'nextQuestion' }),
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
      dismissVerify: () => dispatch({ type: 'dismissVerify' }),
      setProfile: (profile) => dispatch({ type: 'setProfile', profile }),
      loadGame: (players, buyIn) => dispatch({ type: 'loadGame', players, buyIn }),
    }),
    [state],
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
