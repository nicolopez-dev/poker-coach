/**
 * The password rule, in one place, matching what the server will actually accept.
 *
 * **Length is the only rule the form enforces.** Character-class requirements were
 * dropped deliberately: they push people towards `Password1!` — long enough, four
 * classes, and near the top of every breach list — while doing nothing about the
 * passwords that actually get accounts taken. The project checks candidates against
 * Have I Been Pwned instead, which catches exactly those.
 *
 * That check can only happen on the server, so a breached password arrives as a
 * `weak_password` error with `reasons: ['pwned']` rather than being caught here. The
 * split is deliberate: this file checks what the client can know, `errors.ts` says the
 * rest. Neither is allowed to guess at the other's job — see the `characters` bug in
 * `errors.test.ts` for what that costs.
 *
 * The server's half is `minimum_password_length` and "Prevent use of leaked passwords"
 * in Authentication → Sign In / Providers, mirrored in `supabase/config.toml`. Change
 * either and change this in the same commit.
 */

export const MIN_PASSWORD = 10;

/** Said up front, under the field, before it can be broken. */
export const PASSWORD_RULE = 'Ten characters or more. Longer beats complicated.';

/**
 * What is wrong with this password, or null if nothing is — as far as the client can
 * tell. A breached password looks fine from here and is refused by the server.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return 'Ten characters or more, please.';
  return null;
}

/**
 * A hint once the rule is met, never a gate. Length carries most of the weight, so a
 * long passphrase reads as well as a short thicket of symbols — which is the habit
 * worth encouraging.
 */
export function strength(password: string): string | null {
  if (passwordProblem(password)) return null;

  const variety =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));

  if (password.length >= 16 || variety >= 3) return 'Strong.';
  if (password.length >= 13 || variety >= 2) return 'Decent.';
  return 'It will do.';
}
