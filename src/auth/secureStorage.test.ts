import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { CHUNK_BYTES, chunk, secureStorage } from './secureStorage';

// The adapter falls back to AsyncStorage on web, so its native module has to resolve
// even though these tests run against the SecureStore branch.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * A fake SecureStore that enforces the real 2048-byte ceiling, so a test that stops
 * chunking fails here rather than on a device.
 */
jest.mock('expo-secure-store', () => {
  const VALUE_LIMIT = 2048;
  const items = new Map<string, string>();

  const bytes = (value: string) => new TextEncoder().encode(value).length;

  return {
    __items: items,
    getItemAsync: jest.fn(async (key: string) => (items.has(key) ? items.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      if (bytes(value) > VALUE_LIMIT) {
        throw new Error(`Value for key ${key} exceeds ${VALUE_LIMIT} bytes`);
      }
      items.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      items.delete(key);
    }),
  };
});

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;

const KEY = 'sb-pokercoach-auth-token';

beforeEach(() => {
  items.clear();
  jest.clearAllMocks();
});

it('runs against the SecureStore backend, which is where the byte ceiling lives', () => {
  // on web the adapter uses AsyncStorage, which has no such limit — if this suite ever
  // runs there it stops proving the thing it exists to prove
  expect(Platform.OS).not.toBe('web');
});

describe('chunk', () => {
  it('keeps a small value whole', () => {
    expect(chunk('a short session')).toEqual(['a short session']);
  });

  it('splits a long value into full chunks', () => {
    const parts = chunk('a'.repeat(CHUNK_BYTES * 3 + 1));
    expect(parts).toHaveLength(4);
    expect(parts.slice(0, 3).every((p) => p.length === CHUNK_BYTES)).toBe(true);
    expect(parts[3]).toBe('a');
  });

  it('never splits a multi-byte character', () => {
    // ♠ is three UTF-8 bytes, so a limit that is not a multiple of three has to break early
    const parts = chunk('♠'.repeat(10), 10);
    expect(parts.join('')).toBe('♠'.repeat(10));
    expect(parts.every((p) => new TextEncoder().encode(p).length <= 10)).toBe(true);
  });

  it('round-trips an empty value as one empty chunk', () => {
    expect(chunk('')).toEqual(['']);
  });
});

describe('secureStorage', () => {
  it('reads back nothing for a key never written', async () => {
    await expect(secureStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('round-trips a value that fits in one chunk', async () => {
    await secureStorage.setItem(KEY, 'small');
    expect(items.get(`${KEY}.n`)).toBe('1');
    await expect(secureStorage.getItem(KEY)).resolves.toBe('small');
  });

  it('round-trips a value spanning four chunks', async () => {
    const session = 'x'.repeat(CHUNK_BYTES * 3 + 200);

    await secureStorage.setItem(KEY, session);

    expect(items.get(`${KEY}.n`)).toBe('4');
    expect([...items.keys()].sort()).toEqual(
      [`${KEY}.0`, `${KEY}.1`, `${KEY}.2`, `${KEY}.3`, `${KEY}.n`].sort(),
    );
    await expect(secureStorage.getItem(KEY)).resolves.toBe(session);
  });

  it('round-trips a value with em dashes and suit glyphs', async () => {
    const session = '♠♥♦♣ — a session — '.repeat(400);

    await secureStorage.setItem(KEY, session);

    await expect(secureStorage.getItem(KEY)).resolves.toBe(session);
  });

  it('drops stale chunks when a rewrite shrinks the count', async () => {
    await secureStorage.setItem(KEY, 'y'.repeat(CHUNK_BYTES * 3 + 200));
    expect(items.get(`${KEY}.n`)).toBe('4');

    await secureStorage.setItem(KEY, 'z'.repeat(CHUNK_BYTES + 1));

    expect(items.get(`${KEY}.n`)).toBe('2');
    expect(items.has(`${KEY}.2`)).toBe(false);
    expect(items.has(`${KEY}.3`)).toBe(false);
    await expect(secureStorage.getItem(KEY)).resolves.toBe('z'.repeat(CHUNK_BYTES + 1));
  });

  it('leaves nothing behind on removeItem', async () => {
    await secureStorage.setItem(KEY, 'w'.repeat(CHUNK_BYTES * 3 + 200));

    await secureStorage.removeItem(KEY);

    expect([...items.keys()]).toEqual([]);
    await expect(secureStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('reads as absent when a chunk has gone missing', async () => {
    await secureStorage.setItem(KEY, 'v'.repeat(CHUNK_BYTES * 3 + 200));

    items.delete(`${KEY}.2`);

    await expect(secureStorage.getItem(KEY)).resolves.toBeNull();
  });

  it('round-trips an empty value', async () => {
    await secureStorage.setItem(KEY, '');
    await expect(secureStorage.getItem(KEY)).resolves.toBe('');
  });
});
