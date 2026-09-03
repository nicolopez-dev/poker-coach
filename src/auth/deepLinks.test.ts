/**
 * The parser only. Redeeming a link needs a server; that half is exercised against the
 * local stack, and the shapes below are the ones GoTrue has actually been observed to
 * send — a code in the query, a token hash with a type, tokens in the fragment, and an
 * error when the link is spent.
 */

// The parser needs no client, and building one would demand the environment and the
// native storage module. Redeeming is covered against the running stack instead.
jest.mock('./supabase', () => ({ supabase: { auth: {} } }));

import { parseAuthLink } from './deepLinks';

const CALLBACK = 'pokercoach://auth-callback';

describe('parseAuthLink', () => {
  it('reads the PKCE code out of the query', () => {
    expect(parseAuthLink(`${CALLBACK}?code=abc-123`)).toEqual({ kind: 'code', code: 'abc-123' });
  });

  it('reads a token hash and its type', () => {
    expect(parseAuthLink(`${CALLBACK}?token_hash=deadbeef&type=recovery`)).toEqual({
      kind: 'tokenHash',
      tokenHash: 'deadbeef',
      type: 'recovery',
    });
  });

  it('accepts the older `token` spelling of the same thing', () => {
    expect(parseAuthLink(`${CALLBACK}?token=deadbeef&type=signup`)).toEqual({
      kind: 'tokenHash',
      tokenHash: 'deadbeef',
      type: 'signup',
    });
  });

  it('reads the implicit flow out of the fragment', () => {
    expect(
      parseAuthLink(`${CALLBACK}#access_token=at-1&refresh_token=rt-1&type=recovery`),
    ).toEqual({ kind: 'tokens', accessToken: 'at-1', refreshToken: 'rt-1' });
  });

  it('takes an expired link as a failure, not as nothing', () => {
    const link = parseAuthLink(
      `${CALLBACK}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
    );
    expect(link).toEqual({ kind: 'failed', code: 'otp_expired' });
  });

  it('takes a spent link the same way', () => {
    expect(parseAuthLink(`${CALLBACK}?error=access_denied`)).toEqual({
      kind: 'failed',
      code: null,
    });
  });

  it('prefers the failure when a link carries both an error and a code', () => {
    expect(parseAuthLink(`${CALLBACK}?code=abc&error_code=otp_expired`).kind).toBe('failed');
  });

  it('ignores a link that carries nothing of ours', () => {
    expect(parseAuthLink(CALLBACK)).toEqual({ kind: 'none' });
    expect(parseAuthLink('pokercoach://some/other/place?foo=bar')).toEqual({ kind: 'none' });
  });

  it('ignores a token type it does not recognise', () => {
    expect(parseAuthLink(`${CALLBACK}?token_hash=x&type=teleport`)).toEqual({ kind: 'none' });
  });

  it('reads a web callback too, which is how the flow is testable without a device', () => {
    expect(parseAuthLink('http://localhost:8081/?code=web-1')).toEqual({
      kind: 'code',
      code: 'web-1',
    });
  });

  it('survives a fragment that itself contains a hash', () => {
    expect(parseAuthLink(`${CALLBACK}#access_token=a#b&refresh_token=rt`).kind).toBe('tokens');
  });
});
