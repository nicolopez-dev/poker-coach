/**
 * Google, through the native ID-token flow.
 *
 * The alternative — `signInWithOAuth` and a browser round trip — hands the account
 * chooser to a web view and comes back through a redirect that the app has to trust.
 * This way Google's own sheet does the work, hands back a signed ID token, and Supabase
 * verifies that token against Google's keys. Nothing in between gets to see or forge it.
 *
 * Needs a custom dev build: the module is native, so Expo Go cannot load it.
 */

import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { authErrorMessage } from './errors';
import { supabase } from './supabase';

/**
 * The **Web** client id, not the platform ones. Supabase checks the token's `aud`
 * against what its Google provider is configured with, and that is the web client —
 * the iOS and Android clients exist so Google will issue the token in the first place.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * A cancelled sign-in is not a failure — the player closed the sheet. Callers show
 * nothing at all for it, which is why this is a state rather than a message.
 */
export type GoogleOutcome =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

const CANCELLED: GoogleOutcome = { ok: false, cancelled: true };

const NOT_CONFIGURED =
  'Google sign-in is not set up in this build. Use your email and password.';

/**
 * The web build of the module answers `PLAY_SERVICES_NOT_AVAILABLE`, which is true but
 * useless to read in a browser. Say the actual reason instead.
 */
const NATIVE_ONLY = 'Google sign-in only works in the app. Use your email and password here.';

let configured = false;

/** Configuring twice is harmless, but there is no reason to do it on every press. */
function configure(): boolean {
  if (!WEB_CLIENT_ID) return false;
  if (configured) return true;

  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    // the ID token is the whole point; no server auth code round trip
    offlineAccess: false,
  });
  configured = true;
  return true;
}

export async function signInWithGoogle(): Promise<GoogleOutcome> {
  // The ID-token flow is a native module: there is nothing to fall back to in a browser,
  // and pretending otherwise produces a misleading error.
  if (Platform.OS === 'web') return { ok: false, cancelled: false, message: NATIVE_ONLY };
  if (!configure()) return { ok: false, cancelled: false, message: NOT_CONFIGURED };

  try {
    // Android only, and it throws rather than returns when Play Services are missing
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();

    // v16 returns a discriminated result: cancelling is `type: 'cancelled'`, not a throw
    if (response.type === 'cancelled') return CANCELLED;

    const idToken = response.data?.idToken;
    if (!idToken) {
      return {
        ok: false,
        cancelled: false,
        message: 'Google did not hand back a token. Try again.',
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { ok: false, cancelled: false, message: authErrorMessage(error) };

    return { ok: true };
  } catch (error: unknown) {
    // older versions of the module, and some paths in this one, still throw to cancel
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return CANCELLED;
      if (error.code === statusCodes.IN_PROGRESS) return CANCELLED;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          ok: false,
          cancelled: false,
          message: 'Google Play services are needed for this. Use your email and password.',
        };
      }
    }
    return {
      ok: false,
      cancelled: false,
      message: "Google sign-in didn't finish. Try again.",
    };
  }
}

/**
 * Ends the Google session alongside the Supabase one, so the next press offers the
 * account chooser instead of silently reusing the last account.
 */
export async function signOutOfGoogle(): Promise<void> {
  if (!configured) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // nothing the player can do about it, and their Supabase session is already gone
  }
}
