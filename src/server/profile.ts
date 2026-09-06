/**
 * The profile, read and written.
 *
 * The write is `set_profile` and lives in [[client]] with the rest of the RPCs; what is
 * left here is the read — a plain select, which RLS scopes to the caller's own row — and
 * the shape the app speaks in. `saveProfile` wraps the RPC into the `{ ok, message }`
 * result the screens already expect, so a failure carries copy and never an error.
 *
 * **Writes go through `set_profile`, never through the table.** `profiles` has an update
 * policy, but RLS grants rows rather than columns — the trigger added in P2 is what
 * stops a direct update rewriting `created_at` or `user_id`. Going through the function
 * keeps that one door, and keeps the rule uniform with the tables that have no update
 * policy at all.
 */

import { supabase } from '../auth/supabase';
import { serverErrorMessage, setProfile } from './client';

export type Profile = {
  displayName: string | null;
  avatarId: string | null;
};

export type SaveResult = { ok: true; profile: Profile } | { ok: false; message: string };

/** Rows come back snake_case; the app speaks camelCase everywhere else. */
type ProfileRow = { display_name: string | null; avatar_id: string | null };

function toProfile(row: ProfileRow | null | undefined): Profile {
  return { displayName: row?.display_name ?? null, avatarId: row?.avatar_id ?? null };
}

/**
 * The caller's own profile. RLS scopes the select, so there is no user id to pass and
 * no way to ask for anyone else's.
 */
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_id')
    .maybeSingle();

  if (error) return null;
  return toProfile(data);
}

/**
 * A null argument leaves that field alone — the function's own contract, so the name
 * can be changed without resending the avatar and the other way round.
 */
export async function saveProfile(
  displayName: string | null,
  avatarId: string | null,
): Promise<SaveResult> {
  try {
    return { ok: true, profile: await setProfile(displayName, avatarId) };
  } catch (error) {
    return { ok: false, message: serverErrorMessage(error) };
  }
}
