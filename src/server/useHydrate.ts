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

import { useEffect } from 'react';

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
 */
export function useHydrate(userId: string | null, dispatch: (action: HydrateAction) => void) {
  useEffect(() => {
    if (!userId) return;

    // Two flags rather than one. `live` drops everything once the user changes or the
    // provider unmounts — one player's streak must never land in another's store. The
    // second is the race between the two reads: the cache is usually first, but a slow
    // disk behind a fast network would otherwise let stale numbers overwrite fresh ones.
    let live = true;
    let answered = false;

    readCachedState(userId).then((cached) => {
      if (!live || answered || !cached) return;
      // no clock offset from the cache: a stored one says nothing about the device's
      // clock now, and zero is the honest answer until the server gives a real one
      dispatch({ type: 'hydrate', state: cached, clockOffset: 0, source: 'cache' });
    });

    dispatch({ type: 'syncStart' });

    getState()
      .then(async (state) => {
        answered = true;
        if (!live) return;
        dispatch({
          type: 'hydrate',
          state,
          clockOffset: Date.parse(state.serverNow) - Date.now(),
          source: 'server',
        });
        await writeCachedState(userId, state);
      })
      .catch((error: unknown) => {
        if (live) dispatch({ type: 'syncFailed', message: serverErrorMessage(error) });
      });

    return () => {
      live = false;
    };
  }, [userId, dispatch]);
}
