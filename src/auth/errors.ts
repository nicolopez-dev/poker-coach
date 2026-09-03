/**
 * Supabase auth errors, said in the app's voice.
 *
 * Two rules shape this file, both from docs/accounts-plan.md §3:
 *
 *  · **A wrong password and an unknown address read identically.** So do a reset for an
 *    address that exists and one that does not, and a sign-up for a taken address and a
 *    free one. Anything else turns the login screen into an account-enumeration oracle.
 *  · **No raw Supabase string ever reaches a user.** An unmapped code falls back to the
 *    generic line rather than leaking "AuthApiError: invalid_grant" into the UI.
 *
 * Copy is sentence case with a full stop, matching the handoff.
 */

import type { AuthError } from '@supabase/supabase-js';

import { PASSWORD_RULE } from './password';

/** What every unmapped failure says. */
export const GENERIC = 'Something went wrong. Try again.';

/**
 * Deliberately identical for a wrong password, an address with no account, and a
 * malformed one — the login screen must not say which.
 */
const NO_MATCH = "That email and password don't match.";

/** Deliberately identical whether or not the address has an account. */
const CHECK_INBOX = 'Check your inbox to finish signing up.';

const MESSAGES: Record<string, string> = {
  // sign-in
  invalid_credentials: NO_MATCH,
  user_not_found: NO_MATCH,
  email_address_invalid: NO_MATCH,
  validation_failed: NO_MATCH,
  email_not_confirmed: 'Check your inbox — that address still needs confirming.',
  user_banned: 'That account is closed. Get in touch if you think it should not be.',

  // sign-up
  email_exists: CHECK_INBOX,
  user_already_exists: CHECK_INBOX,
  signup_disabled: 'New accounts are closed at the moment.',
  email_provider_disabled: 'Email sign-in is switched off at the moment.',
  provider_disabled: 'That way in is switched off at the moment.',
  email_address_not_authorized: CHECK_INBOX,

  // passwords — `weak_password` is handled separately, from its reasons
  same_password: "That's the password you already have.",
  reauthentication_needed: 'Log in again before changing your password.',

  // links and codes
  otp_expired: 'That link has expired. Ask for a new one.',
  otp_disabled: 'That link no longer works. Ask for a new one.',
  flow_state_expired: 'That link has expired. Ask for a new one.',
  flow_state_not_found: 'That link has expired. Ask for a new one.',
  bad_code_verifier: 'That link was opened on a different device. Try again from this one.',

  // the session went away underneath us
  session_expired: 'You have been signed out. Log in again.',
  session_not_found: 'You have been signed out. Log in again.',
  refresh_token_not_found: 'You have been signed out. Log in again.',
  refresh_token_already_used: 'You have been signed out. Log in again.',
  bad_jwt: 'You have been signed out. Log in again.',

  // slow down
  over_request_rate_limit: 'Too many tries. Give it a minute.',
  over_email_send_rate_limit: 'Too many emails just now. Give it a minute.',
  captcha_failed: "We couldn't tell you apart from a bot. Try again.",
};

/**
 * The subset of `AuthError` this reads — so a test needs no class to construct one.
 * `reasons` rides along on `AuthWeakPasswordError` and is absent everywhere else.
 */
export type AuthFailure = Pick<AuthError, 'code' | 'name'> & {
  reasons?: readonly string[];
};

/**
 * A refused password has up to three separate reasons, and saying the wrong one is
 * worse than saying nothing: telling someone their twelve-character password is too
 * short sends them off to add a thirteenth character and be refused again.
 *
 * `pwned` is the one that matters here — the project checks Have I Been Pwned, and the
 * client cannot, so this is the only place that failure can be explained. `characters`
 * should not arrive while the policy is length-only, but it is still answered properly
 * rather than folded into the generic, because policies get changed in dashboards.
 */
function weakPassword(reasons: readonly string[] = []): string {
  const because = (reason: string) => reasons.includes(reason);

  // a breach is about *this* password rather than about the policy, so it goes first
  // however it arrives — and it is the only reason the player cannot see coming
  if (because('pwned')) {
    return 'That password has turned up in a data breach. Pick a different one.';
  }
  if (because('characters') && because('length')) return PASSWORD_RULE;
  if (because('characters')) return 'Add a capital, a number and a symbol.';
  if (because('length')) return 'Pick a longer password — ten characters or more.';

  // a reason this SDK has not heard of: say the rule rather than guess at the cause
  return PASSWORD_RULE;
}

/**
 * The line to show a user for a failed auth call. Anything unrecognised — an unmapped
 * code, a code the server added after this SDK, no code at all — gets the generic.
 */
export function authErrorMessage(error: AuthFailure | null | undefined): string {
  if (!error) return GENERIC;

  // thrown before any response: the request never landed
  if (error.name === 'AuthRetryableFetchError') {
    return "Can't reach the table right now. Check your connection.";
  }

  if (error.code === 'weak_password') return weakPassword(error.reasons);

  return (error.code && MESSAGES[error.code]) || GENERIC;
}
