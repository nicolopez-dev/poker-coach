/**
 * The last state the server sent, kept per user so a cold start has something true to
 * show before the network answers.
 *
 * **Display only.** Nothing here is ever authoritative: the server's answer overwrites it
 * the moment it lands, and no write is ever made from it. It exists so a player with a
 * forty-day streak does not watch a zero for a second on every launch.
 *
 * AsyncStorage, not SecureStore — this is a copy of numbers the player can already see,
 * and the session that protects them lives elsewhere (§3 rule 6). The key carries the
 * user id, so two accounts on one phone cannot read each other's progress.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlayerState } from './client';

/** Bumped whenever `PlayerState` changes shape; an older blob is dropped, not migrated. */
const VERSION = 3;

const key = (userId: string) => `pokerCoach.state.v${VERSION}.${userId}`;

/**
 * The cached state, or null when there is none — a first sign-in on this device, a
 * cleared store, or a blob written by a version that shaped it differently.
 */
export async function readCachedState(userId: string): Promise<PlayerState | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? parse(raw) : null;
  } catch {
    // an unreadable cache is simply no cache; the server is about to answer anyway
    return null;
  }
}

export async function writeCachedState(userId: string, state: PlayerState): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    // nothing here is load-bearing, so a full disk costs a skeleton on the next launch
  }
}

/** Forgets one player's cache — signing out of a shared device, or deleting an account. */
export async function clearCachedState(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // same again: a cache that will not clear is overwritten on the next hydrate
  }
}

/**
 * Validated field by field rather than trusted: a blob half-written by an older build
 * would otherwise put a `NaN` streak on screen, which is worse than a skeleton.
 */
function parse(raw: string): PlayerState | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;
  const state = value as Record<string, unknown>;

  const numbers = [
    'hearts',
    'streak',
    'storedStreak',
    'longestStreak',
    'xp',
    'accuracy',
    'lessonsToday',
    'games',
  ] as const;
  if (numbers.some((field) => typeof state[field] !== 'number')) return null;
  if (typeof state.streakAtRisk !== 'boolean') return null;
  if (typeof state.serverNow !== 'string') return null;

  const dates = ['nextHeartAt', 'streakExpiresAt', 'streakDay'] as const;
  if (dates.some((f) => state[f] !== null && typeof state[f] !== 'string')) return null;

  if (!Array.isArray(state.week)) return null;
  if (typeof state.chapters !== 'object' || state.chapters === null) return null;

  if (
    !Array.isArray(state.completedLessons) ||
    state.completedLessons.some((id) => typeof id !== 'string')
  ) {
    return null;
  }

  return state as unknown as PlayerState;
}
