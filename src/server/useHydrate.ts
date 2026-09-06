/**
 * Filling the store from the server.
 *
 * On sign-in this reads the cached snapshot for that user — so a returning player sees
 * their own hearts and streak in the first frame — and then calls `get_state()`, whose
 * answer overwrites it outright. The cache is display-only (see [[stateCache]]); the
 * server is the authority, always.
 *
 * It also captures `server_now - Date.now()` as `clockOffset`. Every countdown in the app
 * is measured against that offset rather than the device clock, so moving the phone's
 * clock forward does not conjure hearts (§3 rule 8).
 */

import { useCallback, useEffect, useRef } from 'react';

import { getState, serverErrorMessage, type PlayerState } from './client';
import { readCachedState, writeCachedState } from './stateCache';

/** Where a set of numbers came from. The server's answer supersedes the cache's. */
export type HydrateSource = 'cache' | 'server';

/**
 * What hydration tells the store. The store folds these into its own `Action` union, so
 * this module never has to know how the state is shaped beyond `PlayerState`.
 */
export type HydrateAction =
  | { type: 'syncStart' }
  | { type: 'syncFailed'; message: string }
  | { type: 'hydrate'; state: PlayerState; clockOffset: number; source: HydrateSource };

/**
 * `userId` is null whenever nobody is signed in; the effect then does nothing, and the
 * store's own sign-out reset is what clears the last player's numbers.
 *
 * Returns a way to ask again — used when a heart's countdown runs out, and by P15 on
 * every foreground, since a streak goes stale across local midnight.
 */
export function useHydrate(
  userId: string | null,
  dispatch: (action: HydrateAction) => void,
  /** run after the server answers — where the outbox gets flushed */
  onHydrated?: () => void,
): () => void {
  // Whose store this is, right now. A reply that arrives after a sign-out, or after
  // somebody else signed in, is dropped: one player's streak must never land in
  // another's store.
  const active = useRef(userId);
  useEffect(() => {
    active.current = userId;
  }, [userId]);

  // Whether the server has answered for this user yet. The cache is usually first, but
  // a slow disk behind a fast network would otherwise let stale numbers overwrite fresh.
  const served = useRef(false);

  // In a ref so that passing a fresh closure on every render does not re-run the hydrate
  const after = useRef(onHydrated);
  after.current = onHydrated;

  const sync = useCallback(async () => {
    if (!userId) return;
    dispatch({ type: 'syncStart' });

    try {
      const state = await getState();
      if (active.current !== userId) return;
      served.current = true;
      dispatch({
        type: 'hydrate',
        state,
        clockOffset: Date.parse(state.serverNow) - Date.now(),
        source: 'server',
      });
      await writeCachedState(userId, state);
      after.current?.();
    } catch (error: unknown) {
      if (active.current === userId) {
        dispatch({ type: 'syncFailed', message: serverErrorMessage(error) });
      }
    }
  }, [userId, dispatch]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    served.current = false;

    readCachedState(userId).then((cached) => {
      if (!live || served.current || !cached) return;
      // no clock offset from the cache: a stored one says nothing about the device's
      // clock now, and zero is the honest answer until the server gives a real one
      dispatch({ type: 'hydrate', state: cached, clockOffset: 0, source: 'cache' });
    });

    void sync();

    return () => {
      live = false;
    };
  }, [userId, dispatch, sync]);

  return sync;
}
