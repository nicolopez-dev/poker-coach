/**
 * The two things a player can do to the account itself: take a copy of it, and end it.
 *
 * Both are required rather than nice to have — Apple 5.1.1(v) wants deletion reachable
 * in the app rather than through a support address, and GDPR wants both (§3 rule 10).
 * The RPCs live in [[client]] with the rest; what is here is the part that is not a
 * round trip: writing the export to a file, offering it to the share sheet, and
 * forgetting this phone's own copies of a player who has just deleted themselves.
 *
 * Both wrap into the `{ ok, message }` result the screens already expect, exactly as
 * `saveProfile` does — a failure carries copy, never an error.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { deleteAccount, getExport, serverErrorMessage } from './client';
import { clearOutbox } from './outbox';
import { clearCachedState } from './stateCache';
import { clearLapses } from './streakAck';

export type AccountResult = { ok: true } | { ok: false; message: string };

/** Copy for the two failures that are this file's own rather than the server's. */
const NOT_WRITTEN = "We couldn't write the file. Check there's room on this device.";
const NO_SHARING = 'There is nowhere to send the file from this device.';

/** `poker-coach-data-2026-09-07.json` — dated, so two exports are two files. */
function filename(at: Date): string {
  return `poker-coach-data-${at.toISOString().slice(0, 10)}.json`;
}

/**
 * The whole account as a json file, handed to the share sheet.
 *
 * The cache directory rather than documents: this is a copy the player is about to send
 * somewhere, not something the app keeps, and the system is free to reclaim it once they
 * have. Re-exporting on the same day overwrites rather than piling up.
 *
 * Indented on purpose — the point of Article 20 is that the file can be read, and by a
 * person as much as by a machine.
 */
export async function exportData(now: Date = new Date()): Promise<AccountResult> {
  // Asked first, before anything is fetched or written: a file left in a sandbox the
  // player cannot open is not an export, and there is nowhere to put it on the web build
  // or on a bare simulator. Nothing in here throws past this function — a screen that
  // shows "Gathering your data…" has to be told when to stop.
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, message: NO_SHARING };
  } catch {
    return { ok: false, message: NO_SHARING };
  }

  let document;
  try {
    document = await getExport();
  } catch (error) {
    return { ok: false, message: serverErrorMessage(error) };
  }

  let uri: string;
  try {
    // the constructor validates the path, so it belongs inside the guard with the write
    const file = new File(Paths.cache, filename(now));
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify(document, null, 2));
    uri = file.uri;
  } catch {
    return { ok: false, message: NOT_WRITTEN };
  }

  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      // iOS asks by uniform type identifier rather than by mime type
      UTI: 'public.json',
      dialogTitle: 'Your Poker Coach data',
    });
  } catch {
    return { ok: false, message: NO_SHARING };
  }

  return { ok: true };
}

/**
 * Ends the account, and forgets what this phone kept of it.
 *
 * The server side is one delete: everything hangs off `auth.users` by `on delete
 * cascade`, and supabase/tests/account.test.sql proves that all seven user-owned tables
 * actually empty. What that cannot reach is what this phone kept — the cached state, the
 * outbox and the lapses already acknowledged. None of the three is authoritative and all
 * three are keyed on the user id, so nobody else would ever read them, but they are the
 * deleted player's data and "delete my account" means them too. Each is cleared by the
 * module that owns its key; this is the list of them.
 *
 * Signing out is the caller's to do: the session belongs to [[AuthProvider]], and this
 * module does not know about it.
 */
export async function eraseAccount(userId: string | null): Promise<AccountResult> {
  try {
    await deleteAccount();
  } catch (error) {
    return { ok: false, message: serverErrorMessage(error) };
  }

  if (userId) {
    await clearCachedState(userId);
    await clearOutbox(userId);
    await clearLapses(userId);
  }

  return { ok: true };
}
