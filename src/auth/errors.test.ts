import { GENERIC, authErrorMessage, type AuthFailure } from './errors';
import { PASSWORD_RULE } from './password';

/** A failure shaped like the ones auth-js throws, without needing the class. */
const failure = (code: string | undefined, name = 'AuthApiError'): AuthFailure =>
  ({ code, name }) as AuthFailure;

/** `AuthWeakPasswordError` carries the reasons the password was refused. */
const weak = (...reasons: string[]): AuthFailure =>
  ({ code: 'weak_password', name: 'AuthWeakPasswordError', reasons }) as AuthFailure;

describe('authErrorMessage', () => {
  it('says what went wrong in the app voice', () => {
    expect(authErrorMessage(failure('invalid_credentials'))).toBe(
      "That email and password don't match.",
    );
    expect(authErrorMessage(failure('email_not_confirmed'))).toBe(
      'Check your inbox — that address still needs confirming.',
    );
    expect(authErrorMessage(failure('over_email_send_rate_limit'))).toBe(
      'Too many emails just now. Give it a minute.',
    );
  });

  /**
   * The bug this suite exists to prevent coming back: a twelve-character password
   * refused for its character classes was reported as too short, so the fix was to add
   * a thirteenth character and be refused again.
   */
  describe('a refused password says which rule it broke', () => {
    it('does not call a long password short', () => {
      const message = authErrorMessage(weak('characters'));
      expect(message).toBe('Add a capital, a number and a symbol.');
      expect(message).not.toMatch(/longer|short|ten characters/i);
    });

    it('calls a short password short', () => {
      expect(authErrorMessage(weak('length'))).toBe(
        'Pick a longer password — ten characters or more.',
      );
    });

    it('states the whole rule when both are wrong', () => {
      expect(authErrorMessage(weak('length', 'characters'))).toBe(PASSWORD_RULE);
    });

    /**
     * The live case now that the policy is length-only plus leaked-password
     * protection: the client cannot check a password against a breach list, so this is
     * the only place that refusal can be explained.
     */
    it('names a breach rather than the policy, whichever order it arrives in', () => {
      const breached = 'That password has turned up in a data breach. Pick a different one.';
      expect(authErrorMessage(weak('pwned'))).toBe(breached);
      expect(authErrorMessage(weak('length', 'pwned'))).toBe(breached);
      expect(authErrorMessage(weak('pwned', 'characters'))).toBe(breached);
      // and it must not be mistaken for something the player could have foreseen
      expect(authErrorMessage(weak('pwned'))).not.toBe(PASSWORD_RULE);
    });

    it('falls back to the rule when the reasons are missing or unknown', () => {
      expect(authErrorMessage(weak())).toBe(PASSWORD_RULE);
      expect(authErrorMessage(weak('entropy'))).toBe(PASSWORD_RULE);
      expect(authErrorMessage(failure('weak_password'))).toBe(PASSWORD_RULE);
    });
  });

  it('falls back to the generic for a code it has never seen', () => {
    expect(authErrorMessage(failure('some_code_added_next_year'))).toBe(GENERIC);
  });

  it('falls back to the generic when there is no code at all', () => {
    expect(authErrorMessage(failure(undefined))).toBe(GENERIC);
    expect(authErrorMessage(null)).toBe(GENERIC);
    expect(authErrorMessage(undefined)).toBe(GENERIC);
  });

  it('names a connection failure rather than blaming the credentials', () => {
    expect(authErrorMessage(failure(undefined, 'AuthRetryableFetchError'))).toBe(
      "Can't reach the table right now. Check your connection.",
    );
  });

  describe('never tells an attacker which addresses exist', () => {
    it('reads the same for a wrong password and an unknown address', () => {
      expect(authErrorMessage(failure('user_not_found'))).toBe(
        authErrorMessage(failure('invalid_credentials')),
      );
    });

    it('reads the same for a malformed address as for a wrong one', () => {
      expect(authErrorMessage(failure('email_address_invalid'))).toBe(
        authErrorMessage(failure('invalid_credentials')),
      );
    });

    it('reads the same signing up with a taken address as with a free one', () => {
      // a free address produces no error at all — the screen shows this same line
      expect(authErrorMessage(failure('email_exists'))).toBe(
        'Check your inbox to finish signing up.',
      );
      expect(authErrorMessage(failure('user_already_exists'))).toBe(
        authErrorMessage(failure('email_exists')),
      );
    });
  });

  describe('never surfaces a raw Supabase string', () => {
    // Every code auth-js can send, mapped or not, has to come back as copy we wrote.
    const codes = [
      'unexpected_failure',
      'validation_failed',
      'bad_json',
      'email_exists',
      'bad_jwt',
      'user_not_found',
      'session_expired',
      'signup_disabled',
      'user_banned',
      'invalid_credentials',
      'weak_password',
      'over_request_rate_limit',
      'mfa_verification_failed',
      'hook_timeout',
      'saml_idp_not_found',
    ];

    it.each(codes)('%s reads as written copy', (code) => {
      const message = authErrorMessage(failure(code));
      expect(message).not.toContain(code);
      expect(message).not.toMatch(/Auth(Api|Retryable|Unknown)?Error/);
      expect(message).not.toMatch(/_/);
      // sentence case, ending in a full stop — the handoff's voice
      expect(message).toMatch(/^[A-Z].*\.$/s);
    });
  });
});
