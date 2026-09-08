/**
 * Which lost streak a player has already been told about.
 *
 * A run that ends is worth saying once. Saying it on every launch until they play again
 * would be nagging someone about a thing they cannot undo, so the acknowledgement is
 * remembered against the day the run ended: one card per lapse, and a new one only when
 * a new run ends on a different day.
 *
 * Local, per user, and nowhere near the database — like [[stateCache]], losing it costs
 * one repeated card and nothing else.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId: string, streakDay: string) => `pokerCoach.lapse.v1.${userId}.${streakDay}`;

/** Whether the lapse that ended on `streakDay` has already been acknowledged. */
export async function lapseSeen(userId: string, streakDay: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId, streakDay))) !== null;
  } catch {
    // an unreadable store means we cannot prove it was seen; showing it twice is the
    // kinder failure than swallowing it
    return false;
  }
}

export async function markLapseSeen(userId: string, streakDay: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId, streakDay), new Date().toISOString());
  } catch {
    // the card comes back next launch, which is a small cost for a full disk
  }
}

/**
 * Forgets every lapse this player was told about — one of the three local copies
 * [[account]] clears when an account ends. Enumerated rather than removed by key: the
 * day the run ended is part of the key, so there is no single one to reach for.
 */
export async function clearLapses(userId: string): Promise<void> {
  try {
    const prefix = `pokerCoach.lapse.v1.${userId}.`;
    const keys = (await AsyncStorage.getAllKeys()).filter((stored) => stored.startsWith(prefix));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // nothing here is load-bearing; the worst a leftover costs is a card not shown
  }
}
