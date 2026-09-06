import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlayerState } from './client';
import { clearCachedState, readCachedState, writeCachedState } from './stateCache';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

const STATE: PlayerState = {
  hearts: 3,
  nextHeartAt: '2026-09-05T18:00:00.000Z',
  streak: 40,
  streakAtRisk: true,
  streakExpiresAt: '2026-09-05T22:00:00.000Z',
  longestStreak: 41,
  xp: 1240,
  accuracy: 0.78,
  completedLessons: ['felt-1', 'felt-2'],
  serverNow: '2026-09-05T14:00:00.000Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('a written state comes back as it went in', async () => {
  await writeCachedState(ALICE, STATE);
  expect(await readCachedState(ALICE)).toEqual(STATE);
});

test('there is nothing cached for a player who has never hydrated', async () => {
  expect(await readCachedState(ALICE)).toBeNull();
});

test('one account cannot read another account’s progress', async () => {
  await writeCachedState(ALICE, STATE);
  expect(await readCachedState(BOB)).toBeNull();
});

test('clearing forgets that player and leaves the others alone', async () => {
  await writeCachedState(ALICE, STATE);
  await writeCachedState(BOB, { ...STATE, streak: 1 });

  await clearCachedState(ALICE);

  expect(await readCachedState(ALICE)).toBeNull();
  expect(await readCachedState(BOB)).toEqual({ ...STATE, streak: 1 });
});

test('a blob that is not json is no cache rather than a crash', async () => {
  await writeCachedState(ALICE, STATE);
  const key = (await AsyncStorage.getAllKeys()).find((k) => k.includes(ALICE))!;
  await AsyncStorage.setItem(key, 'half a wri');

  expect(await readCachedState(ALICE)).toBeNull();
});

test('a state missing a field is dropped, not shown with holes in it', async () => {
  await writeCachedState(ALICE, STATE);
  const key = (await AsyncStorage.getAllKeys()).find((k) => k.includes(ALICE))!;
  const { streak: _streak, ...withoutStreak } = STATE;
  await AsyncStorage.setItem(key, JSON.stringify(withoutStreak));

  expect(await readCachedState(ALICE)).toBeNull();
});

test('a state whose lesson ids are not strings is dropped', async () => {
  await writeCachedState(ALICE, STATE);
  const key = (await AsyncStorage.getAllKeys()).find((k) => k.includes(ALICE))!;
  await AsyncStorage.setItem(key, JSON.stringify({ ...STATE, completedLessons: [1, 2] }));

  expect(await readCachedState(ALICE)).toBeNull();
});
