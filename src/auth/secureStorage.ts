import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * expo-secure-store ships no web implementation — its web module is an empty object, so
 * every call is a TypeError. On web the session goes to AsyncStorage, which is
 * localStorage, which is **not** secure storage: it is readable by any script on the
 * origin. Web is the development and preview target here; iOS and Android are what ship,
 * and they get the Keychain and the Keystore as §3 rule 6 requires.
 */
const store =
  Platform.OS === 'web'
    ? {
        get: (key: string) => AsyncStorage.getItem(key),
        set: (key: string, value: string) => AsyncStorage.setItem(key, value),
        remove: (key: string) => AsyncStorage.removeItem(key),
      }
    : {
        get: (key: string) => SecureStore.getItemAsync(key),
        set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        remove: (key: string) => SecureStore.deleteItemAsync(key),
      };

/**
 * SecureStore rejects values over 2048 bytes, and a Supabase session — access token,
 * refresh token, user row and metadata — is comfortably past that. So a value is split
 * across `<key>.0` … `<key>.n-1`, with `<key>.n` holding the count.
 *
 * The budget sits well under 2048 because Android encrypts the value and base64s the
 * result: the envelope grows the plaintext by roughly a third before it is measured.
 */
export const CHUNK_BYTES = 1400;

const countKey = (key: string) => `${key}.n`;
const partKey = (key: string, index: number) => `${key}.${index}`;

/** UTF-8 width of a code point — chunks are budgeted in bytes, not characters. */
function width(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Splits on code point boundaries, so an em dash or a suit glyph never lands half in
 * one chunk and half in the next. An empty value is one empty chunk, so it comes back
 * as `''` rather than as a missing key.
 */
export function chunk(value: string, limit: number = CHUNK_BYTES): string[] {
  const parts: string[] = [];
  let part = '';
  let bytes = 0;

  for (const character of Array.from(value)) {
    const size = width(character.codePointAt(0) as number);
    if (part && bytes + size > limit) {
      parts.push(part);
      part = '';
      bytes = 0;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);

  return parts;
}

/** How many chunks the last write left behind, or 0 if the key is unwritten. */
async function storedCount(key: string): Promise<number> {
  const stored = await store.get(countKey(key));
  if (stored === null) return 0;
  const count = Number(stored);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

async function getItem(key: string): Promise<string | null> {
  const count = await storedCount(key);
  if (count < 1) return null;

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await store.get(partKey(key, i));
    // a chunk gone missing means a torn write: half a session is worse than none
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function setItem(key: string, value: string): Promise<void> {
  const parts = chunk(value);
  const stale = await storedCount(key);

  for (let i = 0; i < parts.length; i++) {
    await store.set(partKey(key, i), parts[i]);
  }
  // the count lands after the parts it counts, so a write cut short never points at a
  // chunk that was never written
  await store.set(countKey(key), String(parts.length));
  // a shorter value than last time leaves chunks past the new end; drop them
  for (let i = parts.length; i < stale; i++) {
    await store.remove(partKey(key, i));
  }
}

async function removeItem(key: string): Promise<void> {
  const count = await storedCount(key);
  for (let i = 0; i < count; i++) {
    await store.remove(partKey(key, i));
  }
  await store.remove(countKey(key));
}

/** The storage shape `createClient({ auth: { storage } })` expects. */
export const secureStorage = { getItem, setItem, removeItem };
