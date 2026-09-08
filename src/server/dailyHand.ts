/**
 * Which day's hand of the day has been played, and what was picked.
 *
 * The answer itself goes to the server like any other — `submit_answer` marks it, the
 * heart is spent if it was wrong, and the XP follows from the `answers` row. None of
 * that is stored here. What is stored is only the fact that today's hand has been
 * played, so the card comes back locked instead of offering a second go.
 *
 * Local, and deliberately: it gates a card rather than deciding anything. A player who
 * signs in on a second device gets one more crack at the day's hand, and the honest
 * price of that is one more answer in their history, marked as truthfully as the first.
 *
 * AsyncStorage keyed by user, so two accounts on one phone cannot see each other's.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Bumped if this ever changes shape; an older blob is dropped, not migrated. */
const VERSION = 1;

const key = (userId: string) => `pokerCoach.dailyHand.v${VERSION}.${userId}`;

/** A hand that has been played: the local day it belonged to, and the option picked. */
export type PlayedHand = { day: string; optionId: string };

function parse(raw: string): PlayedHand | null {
  try {
    const value = JSON.parse(raw) as Partial<PlayedHand>;
    if (typeof value?.day !== 'string' || typeof value?.optionId !== 'string') return null;
    return { day: value.day, optionId: value.optionId };
  } catch {
    return null;
  }
}

/**
 * What was played, or null for a player who has not answered on this device.
 *
 * The caller compares `day` against today's: a record from yesterday is not today's
 * hand, and the card opens again on its own without anything needing to clear it.
 */
export async function readPlayedHand(userId: string): Promise<PlayedHand | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? parse(raw) : null;
  } catch {
    // an unreadable record is one more go at the day's hand, not a crash
    return null;
  }
}

export async function writePlayedHand(userId: string, played: PlayedHand): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(played));
  } catch {
    // the answer is already on its way to the server; losing the local gate costs a
    // duplicate offer at worst, and is not worth failing the answer over
  }
}

/** Signing out: the record belongs to the player leaving. */
export async function forgetPlayedHand(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // nothing to do about it, and nothing depends on it having happened
  }
}
