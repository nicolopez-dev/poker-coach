/**
 * The profile, read and written.
 *
 * First inhabitant of the layer §2 describes: the only place that talks to the database,
 * so screens never import `supabase` themselves. P12 grows this into the typed RPC
 * client and the offline outbox; for now it is two calls.
 *
 * **Writes go through `set_profile`, never through the table.** `profiles` has an update
 * policy, but RLS grants rows rather than columns — the trigger added in P2 is what
 * stops a direct update rewriting `created_at` or `user_id`. Going through the function
 * keeps that one door, and keeps the rule uniform with the tables that have no update
 * policy at all.
 */

import { authErrorMessage } from '../auth/errors';
import { supabase } from '../auth/supabase';

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
  const { data, error } = await supabase.rpc('set_profile', {
    p_display_name: displayName,
    p_avatar_id: avatarId,
  });

  if (error) return { ok: false, message: authErrorMessage(error) };
  return { ok: true, profile: toProfile(data as ProfileRow) };
}
