/**
 * The session, and nothing else.
 *
 * This layer knows about Supabase and knows nothing about lessons — that boundary is
 * what keeps the rest of the app from turning into a rewrite (docs/accounts-plan.md §2).
 * Screens read `status` to decide what to render and call the methods below; they never
 * touch `supabase.auth` themselves, and they never see an `AuthError`.
 */

import type { AuthError, Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuthDeepLinks } from './deepLinks';
import { authErrorMessage } from './errors';
import { signOutOfGoogle } from './google';
import { supabase } from './supabase';

/**
 * `loading` is the cold start, before the stored session has been read back. It is not
 * the same as signed out, and rendering it as if it were is what makes a valid session
 * flash the login screen on every launch.
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

/**
 * Which of the auth screens is showing. There is no navigation library here — App.tsx
 * switches on this the same way it switches on `tab`, which is the pattern the four tabs
 * and the two overlays already use.
 */
export type AuthScreen = 'login' | 'signUp' | 'forgot' | 'reset' | 'profileSetup';

/**
 * `login` doubles as "no auth screen wanted" — it is the initial value and where
 * signing out returns to, so a signed-in app sitting on it is simply the app.
 *
 * Every other value means the player was deliberately sent somewhere, and some of those
 * happen while signed in: a recovery link signs you in before you have chosen a
 * password, a new account has a session before it has a name, and asking for a fresh
 * reset link from either of those has to stay on top rather than drop into the tabs.
 */
export function authScreenShowing(screen: AuthScreen, signedIn: boolean): boolean {
  return !signedIn || screen !== 'login';
}

/** Every method resolves to one of these — a failure carries copy, never an error. */
export type AuthResult = { ok: true } | { ok: false; message: string };

/**
 * Sign-up has two successes, and the whole point is that the caller cannot tell which
 * of them means "that address was already taken":
 *
 *  · `signedIn`   — a session came back. Confirmation is a soft gate (§1), so the app
 *                   opens now and the banner nags later.
 *  · `checkInbox` — no session. Either the address needs confirming first, or it already
 *                   has an account and Supabase handed back a decoy user. Both show the
 *                   same screen, so sign-up cannot be used to test whether an address is
 *                   registered (§3 rule 7).
 */
export type SignUpResult =
  | { ok: false; message: string }
  | { ok: true; state: 'signedIn' | 'checkInbox' };

export type Auth = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  /** Verification is a soft gate: a banner nags, lessons still play (§1). */
  emailVerified: boolean;
  /**
   * The banner's condition: an unconfirmed address on an account that has a password to
   * confirm it with. A Google or Apple user has nothing to verify and never sees it.
   */
  needsVerification: boolean;
  screen: AuthScreen;
  goTo: (screen: AuthScreen) => void;
  /**
   * Why the last email link did not work — set when a recovery or confirmation link is
   * expired or already spent, so the reset screen can say so instead of showing a form
   * that cannot succeed. Cleared by navigating anywhere but the reset screen.
   */
  linkError: string | null;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  /** `others` leaves this device signed in and ends every other session. */
  signOut: (scope?: 'global' | 'local' | 'others') => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
};

const AuthContext = createContext<Auth | null>(null);

/** Where a confirmation or reset link comes back to; allowlisted in Supabase auth. */
const REDIRECT_TO = 'pokercoach://auth-callback';

const ok: AuthResult = { ok: true };

/** Turns `{ error }` into a result, so the mapping is the only path to a message. */
function result(error: AuthError | null): AuthResult {
  return error ? { ok: false, message: authErrorMessage(error) } : ok;
}

/**
 * Whether this account has an email/password identity. Someone who arrived through
 * Google or Apple has no address of ours to confirm and nothing to resend.
 */
function hasPassword(user: User): boolean {
  const identities = user.identities;
  if (identities?.length) return identities.some((identity) => identity.provider === 'email');
  // no identities on the row: fall back to what the token says issued it
  return user.app_metadata?.provider === 'email';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [linkError, setLinkError] = useState<string | null>(null);

  /** Leaving the reset screen is what clears a dead-link message. */
  const goTo = useCallback((next: AuthScreen) => {
    if (next !== 'reset') setLinkError(null);
    setScreen(next);
  }, []);

  // A link that cannot be redeemed still has to land somewhere it can be explained.
  const onLinkFailure = useCallback((message: string) => {
    setLinkError(message);
    setScreen('reset');
  }, []);

  useAuthDeepLinks(onLinkFailure);

  // Whoever signs out next arrives at the login screen, not at whichever screen the
  // last person happened to leave open.
  //
  // Only on an actual sign-out, not on a cold start that lands signed out: an expired
  // recovery link resolves after `getSession` does, and clearing the screen on that
  // first transition would wipe the explanation before it could be read. The initial
  // screen is `login` anyway, so there is nothing to set.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (status === 'signedIn') wasSignedIn.current = true;
    if (status === 'signedOut' && wasSignedIn.current) {
      wasSignedIn.current = false;
      setScreen('login');
      setLinkError(null);
    }
  }, [status]);

  useEffect(() => {
    let live = true;

    // the cold-start read: SecureStore, through the chunked adapter
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!live) return;
        setSession(data.session);
        setStatus(data.session ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        // an unreadable stored session is a signed-out one, not a stuck splash
        if (live) setStatus('signedOut');
      });

    // and everything after: sign-in, sign-out, token refresh, user updates.
    // Only setState in here — calling back into supabase from this callback deadlocks.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!live) return;
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');

      // The one signal that survives all three link shapes: supabase-js knows a
      // recovery session when it mints one, whether the link carried a code, a token
      // hash or a pair of tokens. The URL itself does not always say.
      if (event === 'PASSWORD_RECOVERY') {
        setLinkError(null);
        setScreen('reset');
      }
    });

    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      emailVerified: Boolean(session?.user?.email_confirmed_at),
      needsVerification: session
        ? !session.user.email_confirmed_at && hasPassword(session.user)
        : false,
      screen,
      goTo,
      linkError,

      signInWithPassword: async (email, password) =>
        result((await supabase.auth.signInWithPassword({ email, password })).error),

      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: REDIRECT_TO },
        });
        if (error) {
          // "That address is taken" is the one failure the caller must never see — it
          // answers the question sign-up is not allowed to answer. Supabase hides it
          // behind a decoy user while email confirmation is on, but says it plainly
          // when it is off, so fold it back into the ordinary outcome here. Otherwise
          // the *shape* of the reply leaks what the copy is careful not to.
          if (error.code === 'email_exists' || error.code === 'user_already_exists') {
            return { ok: true, state: 'checkInbox' };
          }
          return { ok: false, message: authErrorMessage(error) };
        }

        // And the decoy itself: a user row with no identities and no session. Folded
        // into the same branch as "needs confirming" on purpose — the two have to be
        // indistinguishable from out here, including to us.
        const decoy = data.user?.identities?.length === 0;
        return { ok: true, state: data.session && !decoy ? 'signedIn' : 'checkInbox' };
      },

      signOut: async (scope) => {
        const outcome = result((await supabase.auth.signOut({ scope })).error);
        // Ending the Google session too, so the next press offers the account chooser
        // rather than silently signing the same person straight back in. Not for
        // `others`, which deliberately leaves this device as it was.
        if (scope !== 'others') await signOutOfGoogle();
        return outcome;
      },

      sendPasswordReset: async (email) =>
        result(
          (await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_TO })).error,
        ),

      updatePassword: async (password) =>
        result((await supabase.auth.updateUser({ password })).error),

      resendVerification: async (email) =>
        result(
          (await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: REDIRECT_TO },
          })).error,
        ),
    }),
    [session, status, screen, linkError, goTo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
