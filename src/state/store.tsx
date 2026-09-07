import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { AppState, type AppStateStatus } from 'react-native';

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
  DEFAULT_CASE,
  MAX_BUY_IN_UNITS,
  MAX_CHIP_COUNT,
  MAX_CHIP_VALUE,
  MAX_COLORS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_COLORS,
  MIN_PLAYERS,
  SPARE_COLORS,
} from '../data/chipCase';
import { POINTS_PER_UNIT, seatBalance } from '../lib/balance';
import { autoValued, deal, snapValue, type ChipColor, type DealResult } from '../lib/chips';
import { MAX_HEARTS, REGEN_MS, spend, type HeartState } from '../lib/hearts';
import { clamp, digits } from '../lib/num';
import { NAME_MAX_LENGTH } from '../lib/names';
import { liveStreak, localDay, nextLocalMidnight, streakAtRisk, type LocalDay } from '../lib/streak';
import {
  forgetChipCase,
  loadChipCase,
  sameCase,
  saveChipCase,
  type ChipCase,
} from '../server/chipCase';
import { tzOffsetMin, type PlayerState, type WeekDay } from '../server/client';
import {
  fetchGames,
  forgetGames,
  recordDeal,
  saveSeats,
  type GameDeal,
  type RecordedGame,
} from '../server/games';
import { fetchProfile, type Profile } from '../server/profile';
import { useHydrate, type HydrateAction } from '../server/useHydrate';
import { beginRun, finishLesson, recordAnswer, syncOutbox, type DrillAction } from './drill';

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
  /** the run as it stands today: zero once it has lapsed (§6, "Losing a streak") */
  streak: number;
  /** alive, but last extended yesterday — it ends at local midnight unless played */
  streakAtRisk: boolean;
  /** that midnight, as an instant */
  streakExpiresAt: string | null;
  /** the best run ever had; losing one should not erase that it happened */
  longestStreak: number;
  /** the run as stored — the number that ended, once `streak` has resolved to zero */
  storedStreak: number;
  /** the local day the run was last extended; the lapse card is keyed on it */
  streakDay: string | null;
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
  /** the last flush could not reach the server; writes are waiting on this phone */
  offline: boolean;
  /** writes the server refused for good — progress that is gone, and said so */
  unsaved: number;

  /** correct over total, as the server derives it from every answer ever given */
  accuracy: number;
  /** answers per local day, seven days ending today, oldest first */
  week: WeekDay[];
  /** lessons finished today, against the goal of three */
  lessonsToday: number;
  /** games recorded — real, and zero for everyone until P19 writes them */
  games: number;

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

  /**
   * The evening being set up, as `client_event_id`: dealing again keeps it, so a case
   * edited and re-dealt updates one row rather than adding another (see [[games]]).
   */
  gameId: string | null;
  /** the end-of-game counts are in, so the next deal starts a new game */
  gameSettled: boolean;
  /** the last three games, as the server has them */
  recentGames: RecordedGame[];
  /** whether that list has been read at all — an empty panel is not the same as none */
  gamesLoaded: boolean;

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
  streakAtRisk: false,
  streakExpiresAt: null,
  longestStreak: 0,
  storedStreak: 0,
  streakDay: null,
  nextHeartAt: null,

  clockOffset: 0,
  hydrated: false,
  syncing: false,
  syncError: null,
  offline: false,
  unsaved: 0,

  accuracy: 0,
  week: [],
  lessonsToday: 0,
  games: 0,

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

  // the case an account starts with, until the server sends one of its own
  ...DEFAULT_CASE,
  result: null,

  gameId: null,
  gameSettled: false,
  recentGames: [],
  gamesLoaded: false,

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
  | { type: 'chipCaseLoaded'; chipCase: ChipCase }
  | { type: 'go'; tab: Tab }
  | { type: 'startLesson'; ref: LessonRef | undefined }
  | { type: 'closeDrill' }
  | { type: 'pick'; id: string; at: string }
  | { type: 'nextQuestion' }
  | { type: 'stepPlayers'; delta: number }
  | { type: 'setBet'; value: string }
  | { type: 'setAutoValues'; auto: boolean }
  | { type: 'patchColor'; index: number; patch: Partial<ChipColor> }
  | { type: 'addColor' }
  | { type: 'removeColor'; index: number }
  | { type: 'deal'; gameId: string }
  | { type: 'gamesLoaded'; games: RecordedGame[] }
  | { type: 'gamesStale' }
  | { type: 'setEnd'; index: number; value: string }
  | { type: 'setName'; index: number; value: string }
  | { type: 'setEditingName'; index: number | null }
  | { type: 'recomputeStreak'; today: LocalDay; expiresAt: string | null }
  | { type: 'toggleGames' }
  | { type: 'dismissHearts' }
  | { type: 'dismissVerify' }
  | { type: 'loadGame'; game: RecordedGame };

/** Any edit to the case invalidates the deal — the user has to deal again. */
const clearResult = { result: null } as const;

/**
 * How long a return has to be from the last one to be worth asking the server again.
 *
 * Nothing on screen can go stale inside half a minute: hearts regenerate over hours and
 * a streak turns at local midnight.
 */
export const FOREGROUND_REFRESH_MS = 30_000;

/** What a change in app state is worth. */
export type ForegroundWork =
  /** not a return at all */
  | 'none'
  /** a return, but too soon after the last to be worth a round trip */
  | 'day'
  /** a real return: recompute the day and ask the server */
  | 'sync';

/**
 * Whether the app has genuinely just been come back to.
 *
 * Two things make this more than `next === 'active'`. A platform can report active twice
 * without ever having left — so a return is a *transition* into active, from something
 * else. And it can flap: react-native-web reads app state off document visibility, which
 * on some hosts goes active → background → active about once a second, and the app was
 * answering every one of those with a whole `get_state()`. The same flapping happens on a
 * phone, more slowly, whenever the app switcher or a notification shade passes over.
 *
 * The local day is recomputed on every genuine return, because it costs nothing and is
 * the thing that actually changes while away. The server is asked at most once every
 * {@link FOREGROUND_REFRESH_MS}.
 */
export function onForeground(
  previous: AppStateStatus,
  next: AppStateStatus,
  sinceLastSync: number,
): ForegroundWork {
  if (next !== 'active' || previous === 'active') return 'none';
  return sinceLastSync < FOREGROUND_REFRESH_MS ? 'day' : 'sync';
}

/**
 * Colours as the mode has them: the ladder under Auto values, and exactly what was given
 * under My values. Everything that changes the set of colours — or brings a whole case in
 * from the server or a reused game — goes through this, so the case can never sit in Auto
 * values showing something the ladder would not deal.
 */
function cased(autoValues: boolean, colors: ChipColor[]): ChipColor[] {
  return autoValues ? autoValued(colors) : colors;
}

/** The game as [[games]] wants it: the case it was dealt from, plus the stacks. */
function dealOf(eventId: string, chipCase: ChipCase, result: DealResult): GameDeal {
  return {
    eventId,
    players: chipCase.players,
    buyIn: chipCase.buyIn,
    dealtStack: result.val,
    deal: result,
    // stored, not derived: the case is what "Reuse" puts back, and it must be the case
    // that was played with rather than whatever the defaults are by then
    colors: chipCase.colors,
    autoValues: chipCase.autoValues,
  };
}

/** The case on its own, which is what the server stores and what `deal()` takes. */
export function caseOf(state: State): ChipCase {
  const { colors, players, buyIn, autoValues } = state;
  return { colors, players, buyIn, autoValues };
}

/** Questions of the lesson currently running, or none for other lesson kinds. */
function activeQuestions(state: State): Question[] {
  const lesson = findLesson(COURSE, state.activeLesson);
  return isDrill(lesson) ? lesson.questions : [];
}

/**
 * The heart count as `src/lib/hearts.ts` wants it. `settledAt` is not stored — it is
 * `next_heart_at` less one interval, which is the same fact seen from the other end, and
 * `now` at full, where the regen clock idles.
 */
function heartsOf(state: State, at: Date): HeartState {
  return {
    hearts: state.hearts,
    settledAt: state.nextHeartAt ? new Date(Date.parse(state.nextHeartAt) - REGEN_MS) : at,
  };
}

/** The finished list with one more in it, and no duplicates. */
function completedWith(state: State, lessonId: string): string[] {
  return state.completedLessons.includes(lessonId)
    ? state.completedLessons
    : [...state.completedLessons, lessonId];
}

/** One heart spent, in the client's mirror of the server's arithmetic. */
function spent(state: State, at: Date): Pick<State, 'hearts' | 'nextHeartAt'> {
  const next = spend(heartsOf(state, at), at);
  return {
    hearts: next.hearts,
    nextHeartAt:
      next.hearts >= MAX_HEARTS
        ? null
        : new Date(next.settledAt.getTime() + REGEN_MS).toISOString(),
  };
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
    streakAtRisk: player.streakAtRisk,
    streakExpiresAt: player.streakExpiresAt,
    longestStreak: player.longestStreak,
    storedStreak: player.storedStreak,
    streakDay: player.streakDay,
    xp: player.xp,
    accuracy: player.accuracy,
    week: player.week,
    lessonsToday: player.lessonsToday,
    games: player.games,
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

    // The case the server had, adopted only if there is nothing of the player's own to
    // lose by it. An edit made while the read was in flight keeps the tool — that edit
    // is on its way to the server already, and last write wins — and a case that has
    // been dealt from is left alone, because replacing it would void the deal on screen.
    case 'chipCaseLoaded':
      if (state.result || !sameCase(caseOf(state), DEFAULT_CASE)) return state;
      return {
        ...state,
        ...action.chipCase,
        // a case stored under Auto values before the ladder was fixed comes back on the
        // ladder it would be dealt on now, rather than one no longer in use
        colors: cased(action.chipCase.autoValues, action.chipCase.colors),
      };

    // The same arithmetic the server does, run against the day the device is actually
    // in. A phone left open across local midnight must not go on showing yesterday's
    // run as safe, and the stored count is never touched — the lapse stays derived.
    case 'recomputeStreak': {
      const streak = liveStreak(state.storedStreak, state.streakDay, action.today);
      const atRisk = streakAtRisk(state.streakDay, action.today);

      // A day that has not turned yet is no news. Answering with the state it was given
      // is what keeps this cheap enough to run on every return, however often the
      // platform decides that is.
      if (
        streak === state.streak &&
        atRisk === state.streakAtRisk &&
        action.expiresAt === state.streakExpiresAt
      ) {
        return state;
      }

      return { ...state, streak, streakAtRisk: atRisk, streakExpiresAt: action.expiresAt };
    }

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
        // starting the next lesson is how a player acknowledges what was lost
        unsaved: 0,
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

    // Optimistic, and deliberately so: the feedback card must not wait on a round trip,
    // and offline there is no round trip to wait for. Correctness for *rendering* comes
    // from the local course; correctness for the record is decided by the answer key on
    // the server, and `answerRecorded` below is what adopts it. XP is not touched — it
    // is derived from `answers`, never counted here; only `gained`, this drill's own
    // tally, moves.
    //
    // The heart is spent through the same arithmetic the server uses, which settles
    // first: a player who waited out a regen offline gets that heart before this one is
    // taken, exactly as they would online.
    case 'pick': {
      if (state.chosen) return state;
      const question = activeQuestions(state)[state.qi];
      const right = !!question && action.id === question.correct;
      if (right) {
        return { ...state, chosen: action.id, gained: state.gained + XP_PER_ANSWER };
      }

      const at = new Date(action.at);
      try {
        return { ...state, chosen: action.id, ...spent(state, at) };
      } catch {
        // nothing left to spend, and no server needed to know it
        return { ...state, chosen: action.id, hearts: 0, outOfHearts: true, drillOpen: false };
      }
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

    // NetInfo reports on a timer, not only on a change, so most of these say what the
    // last one did. A connection that has not moved leaves the state alone.
    case 'connection': {
      const offline = !action.online;
      return offline === state.offline ? state : { ...state, offline };
    }

    // Progress the server refused: it is not coming back, and the player is told rather
    // than shown a tick. Cleared when they start the next lesson — acknowledged by
    // moving on, rather than nagged.
    case 'unsaved':
      return { ...state, unsaved: state.unsaved + action.count };

    case 'lessonDone':
      return {
        ...state,
        drillDone: true,
        completing: false,
        completionError: null,
        chosen: null,
        // queued offline: the lesson counts here until a flush says otherwise
        completedLessons:
          action.queued && state.activeLesson
            ? completedWith(state, state.activeLesson.lessonId)
            : state.completedLessons,
      };

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
        buyIn: Math.max(1, digits(action.value, MAX_BUY_IN_UNITS)) * POINTS_PER_UNIT,
        ...clearResult,
      };

    // Switching to Auto values lays the ladder over the case there and then, so the
    // fields show what will be dealt rather than the values they had before. Switching
    // the other way leaves them alone: those are now the values on screen, and My values
    // starts from what the player can see.
    case 'setAutoValues':
      return {
        ...state,
        autoValues: action.auto,
        colors: action.auto ? autoValued(state.colors) : state.colors,
        ...clearResult,
      };

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
        // in Auto values the ladder decides, so a colour added or dropped re-rungs the
        // whole case rather than leaving a gap in it
        colors: cased(state.autoValues, [
          ...state.colors,
          { name: pick.name, swatch: pick.swatch, count: 20, value: snapValue(top * 5) },
        ]),
        ...clearResult,
      };
    }

    case 'removeColor':
      if (state.colors.length <= MIN_COLORS) return state;
      return {
        ...state,
        colors: cased(
          state.autoValues,
          state.colors.filter((_, i) => i !== action.index),
        ),
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
        // The evening keeps its id while it is still being set up, so editing the case
        // and dealing again updates one row. Only a settled game — one whose counts are
        // in — hands the next deal a new one.
        gameId: state.gameId && !state.gameSettled ? state.gameId : action.gameId,
        gameSettled: false,
      };
    }

    // A count or a name typed into the Balance card is the evening being settled: from
    // here the seats are recorded, and dealing again starts a new game rather than
    // rewriting the one that has been played.
    case 'setEnd': {
      const ends = state.ends.slice();
      ends[action.index] = digits(action.value, 1000000);
      return { ...state, ends, gameSettled: true };
    }

    case 'setName': {
      const names = state.names.slice();
      names[action.index] = String(action.value).slice(0, NAME_MAX_LENGTH);
      return { ...state, names, gameSettled: true };
    }

    case 'gamesLoaded':
      return { ...state, recentGames: action.games, gamesLoaded: true };

    // Something was written; what the panel is showing is a version behind. It is read
    // again when it is open, and not before — a list nobody is looking at can wait.
    case 'gamesStale':
      return { ...state, gamesLoaded: false };

    case 'setEditingName':
      return { ...state, editingName: action.index };

    case 'toggleGames':
      return { ...state, gamesOpen: !state.gamesOpen };

    case 'dismissVerify':
      return { ...state, verifyDismissed: true };

    // Reuse puts that evening's whole setup back: the seats, the entry, the colours,
    // their counts, what each was worth and whether those values were the ladder's.
    // Everything currently in the case goes — half a setup is not a setup, and the
    // player asked for that night's, not a blend of it and tonight's.
    //
    // The one thing a game recorded before games kept a case cannot give back is the
    // case; there the colours on screen stay as they are.
    case 'loadGame':
      return {
        ...state,
        players: action.game.players,
        buyIn: action.game.buyIn,
        colors: cased(action.game.autoValues, action.game.colors ?? state.colors),
        autoValues: action.game.autoValues,
        result: null,
        ends: [],
        names: [],
        editingName: null,
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
  /** sets the chip tool back up as that evening was, case and all */
  loadGame: (game: RecordedGame) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, user } = useAuth();

  // Hearts, streak, XP and the lessons behind them, from the cache and then the server.
  // Keyed on the user id so that signing in as someone else re-reads from scratch.
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;

  // Hydration, and a flush of whatever was queued while the app was away: a successful
  // hydrate is the third thing that triggers one, beside foreground and reconnect.
  const refresh = useHydrate(userId, dispatch, () => void syncOutbox(dispatch, userId));

  // Held in a ref so the foreground listener below reads the current offset without
  // being torn down and rebuilt on every state change.
  const clockOffset = useRef(state.clockOffset);
  clockOffset.current = state.clockOffset;

  // Signing out clears the store, and so does a session expiring underneath us — one
  // player's hearts and streak must never be the next one's. Resetting to the initial
  // state is idempotent, so a cold start that is already signed out costs nothing.
  useEffect(() => {
    if (status !== 'signedOut') return;
    // the case waiting to be written belongs to the player leaving, and so do the seats
    // and the row they were being written to; all of it goes with them
    forgetChipCase();
    forgetGames();
    dispatch({ type: 'reset' });
  }, [status]);

  // Coming back to the app is when a streak is most likely to have gone stale: the
  // count on screen was worked out on a day that may since have ended. What counts as
  // coming back is [[onForeground]]'s call — the platform is free to say "active" more
  // often than a player actually returns, and on web it does.
  //
  // Both refs and not state: neither belongs on screen, and changing them must not
  // rebuild this listener.
  const appState = useRef(AppState.currentState);
  const syncedAt = useRef(Date.now());

  useEffect(() => {
    if (status !== 'signedIn') return;

    const subscription = AppState.addEventListener('change', (next) => {
      const work = onForeground(appState.current, next, Date.now() - syncedAt.current);
      appState.current = next;
      if (work === 'none') return;

      // The local day first: instant, right with no signal, and the thing that actually
      // goes stale while the app is away.
      const now = new Date(Date.now() + clockOffset.current);
      const offset = tzOffsetMin(now);
      dispatch({
        type: 'recomputeStreak',
        today: localDay(now, offset),
        expiresAt: nextLocalMidnight(now, offset).toISOString(),
      });

      if (work !== 'sync') return;
      syncedAt.current = Date.now();
      void syncOutbox(dispatch, userId);
      refresh();
    });

    return () => subscription.remove();
  }, [status, userId, refresh]);

  // And the moment there is a connection again. A player who finished a lesson on the
  // underground should find it saved by the time they look, without having to do
  // anything — including anything as deliberate as reopening the app.
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = NetInfo.addEventListener((netState) => {
      const online = netState.isConnected !== false;
      dispatch({ type: 'connection', online });
      if (online) void syncOutbox(dispatch, userId);
    });

    return unsubscribe;
  }, [userId]);

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

  // The chip case, read once per sign-in. Whether it is adopted is the reducer's call:
  // an edit made while this was in flight keeps the tool it is holding.
  useEffect(() => {
    if (!userId) return;
    let live = true;

    loadChipCase(userId).then((chipCase) => {
      if (live && chipCase) dispatch({ type: 'chipCaseLoaded', chipCase });
    });

    return () => {
      live = false;
    };
  }, [userId]);

  // And written back after every edit to it, debounced and forgotten: nothing on screen
  // waits on this, an untouched case never creates a row, and a failure is silent (see
  // [[chipCase]]). Dealing counts as an edit — in Auto mode it writes the chosen
  // denominations back into the case, and those are worth keeping too.
  const { colors, players, buyIn, autoValues } = state;
  useEffect(() => {
    if (!userId) return;
    saveChipCase(userId, { colors, players, buyIn, autoValues });
  }, [userId, colors, players, buyIn, autoValues]);

  const { result, gameId, gameSettled, ends, names, gamesOpen, gamesLoaded } = state;

  // The evening being set up, recorded as it is dealt. Editing the case and dealing
  // again writes the same row (see [[games]]) — only a game whose counts are in gets a
  // new one, and that is the one worth a fresh `get_state()`, since the "Games set up"
  // count comes from there rather than from a second count taken here.
  const counted = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !result || !gameId) return;

    const chipCase = { colors, players, buyIn, autoValues };
    void recordDeal(userId, dealOf(gameId, chipCase, result)).then((id) => {
      if (!id) return;
      dispatch({ type: 'gamesStale' });
      if (counted.current === gameId) return;
      counted.current = gameId;
      refresh();
    });
  }, [userId, gameId, result, colors, players, buyIn, autoValues, refresh]);

  // And the seats, once somebody starts counting chips. Debounced inside the module, so
  // typing a count is one write; the balance is worked out here, by the same
  // `src/lib/balance.ts` the card on screen is showing.
  useEffect(() => {
    if (!userId || !result || !gameId || !gameSettled) return;

    saveSeats(
      userId,
      dealOf(gameId, { colors, players, buyIn, autoValues }, result),
      ends.map((end, i) => ({
        index: i,
        name: names[i]?.trim() || null,
        endPoints: end,
        balancePoints: seatBalance(end, buyIn, result.val).net,
      })),
      () => dispatch({ type: 'gamesStale' }),
    );
  }, [userId, gameId, gameSettled, result, ends, names, colors, players, buyIn, autoValues]);

  // Read when the panel is opened, and again after a write while it is open. A list
  // nobody is looking at is not worth a round trip.
  useEffect(() => {
    if (!userId || !gamesOpen || gamesLoaded) return;
    let live = true;

    fetchGames().then((games) => {
      if (live && games) dispatch({ type: 'gamesLoaded', games });
    });

    return () => {
      live = false;
    };
  }, [userId, gamesOpen, gamesLoaded]);

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

      // The dispatch renders the feedback; the write is queued and sent behind it.
      pick: (id) => {
        if (state.chosen || !state.activeLesson) return;
        dispatch({ type: 'pick', id, at: new Date(Date.now() + state.clockOffset).toISOString() });
        void recordAnswer(dispatch, {
          userId,
          ref: state.activeLesson,
          questionIndex: state.qi,
          optionId: id,
          clockOffset: state.clockOffset,
        });
      },

      // The last question finishes the lesson before the done card shows — on the
      // server if it can be reached, and in the queue if it cannot.
      nextQuestion: () => {
        if (state.completing) return;
        if (state.qi < activeQuestions(state).length - 1) {
          dispatch({ type: 'nextQuestion' });
          return;
        }
        if (!state.activeLesson) return;
        dispatch({ type: 'completing' });
        void finishLesson(dispatch, {
          userId,
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
      // the id is minted here rather than in the reducer, which stays a pure function of
      // what it is given; whether it is used at all is the reducer's call
      dealStacks: () => dispatch({ type: 'deal', gameId: Crypto.randomUUID() }),
      setEnd: (index, value) => dispatch({ type: 'setEnd', index, value }),
      setName: (index, value) => dispatch({ type: 'setName', index, value }),
      setEditingName: (index) => dispatch({ type: 'setEditingName', index }),
      toggleGames: () => dispatch({ type: 'toggleGames' }),
      dismissHearts: () => dispatch({ type: 'dismissHearts' }),
      refresh,
      dismissVerify: () => dispatch({ type: 'dismissVerify' }),
      setProfile: (profile) => dispatch({ type: 'setProfile', profile }),
      loadGame: (game) => dispatch({ type: 'loadGame', game }),
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
