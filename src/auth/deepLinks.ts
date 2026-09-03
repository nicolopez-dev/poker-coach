/**
 * Links that come back into the app from an email.
 *
 * Supabase has sent these in three different shapes over the years and still sends
 * different ones depending on the flow and the email template, so this reads all of
 * them rather than betting on one:
 *
 *   ?code=…                          PKCE — exchange it for a session
 *   ?token_hash=…&type=recovery      the current email-template default
 *   #access_token=…&refresh_token=…  the older implicit flow
 *   ?error=…&error_code=otp_expired  a dead link
 *
 * What it does *not* do is decide which screen to show. `exchangeCodeForSession` and
 * `verifyOtp` both make supabase-js emit `PASSWORD_RECOVERY` when the link was a reset,
 * and `AuthProvider` listens for that — which is the one signal that holds across all
 * three shapes, since the PKCE redirect does not carry a `type` of its own.
 */

import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';

import { authErrorMessage } from './errors';
import { supabase } from './supabase';

/** The email one-time-token types a link can carry. */
const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
type OtpType = (typeof OTP_TYPES)[number];

export type AuthLink =
  | { kind: 'none' }
  | { kind: 'code'; code: string }
  | { kind: 'tokenHash'; tokenHash: string; type: OtpType }
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'failed'; code: string | null };

/**
 * Query string and fragment together. GoTrue uses one or the other depending on the
 * flow, and a caller should not have to care which.
 */
function paramsOf(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const [head, ...rest] = url.split('#');
  const fragment = rest.join('#');
  const query = head.includes('?') ? head.slice(head.indexOf('?') + 1) : '';

  for (const source of [query, fragment]) {
    if (!source) continue;
    for (const [key, value] of new URLSearchParams(source)) merged.set(key, value);
  }
  return merged;
}

export function parseAuthLink(url: string): AuthLink {
  const params = paramsOf(url);

  // an expired or already-used link comes back as an error, not as an empty one
  const failure = params.get('error_code') ?? params.get('error');
  if (failure) return { kind: 'failed', code: params.get('error_code') };

  const code = params.get('code');
  if (code) return { kind: 'code', code };

  const tokenHash = params.get('token_hash') ?? params.get('token');
  const type = params.get('type');
  if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
    return { kind: 'tokenHash', tokenHash, type: type as OtpType };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };

  return { kind: 'none' };
}

/**
 * Redeems the link. A success leaves a session behind — a recovery session for a reset
 * link, a confirmed one for a sign-up link, which is what makes the verify banner go.
 */
export async function completeAuthLink(link: AuthLink): Promise<{ ok: boolean; message: string }> {
  switch (link.kind) {
    case 'none':
      return { ok: true, message: '' };

    case 'failed':
      return { ok: false, message: authErrorMessage({ code: link.code ?? undefined, name: '' }) };

    case 'code': {
      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      return error ? { ok: false, message: authErrorMessage(error) } : { ok: true, message: '' };
    }

    case 'tokenHash': {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: link.tokenHash,
        type: link.type,
      });
      return error ? { ok: false, message: authErrorMessage(error) } : { ok: true, message: '' };
    }

    case 'tokens': {
      const { error } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      return error ? { ok: false, message: authErrorMessage(error) } : { ok: true, message: '' };
    }
  }
}

/**
 * Both ways in: the URL that started the app from cold, and the ones that arrive while
 * it is already running. The cold one is read exactly once — `getInitialURL` keeps
 * returning it, and redeeming a code twice fails the second time.
 */
export function useAuthDeepLinks(onFailure: (message: string) => void): void {
  const coldStartHandled = useRef(false);

  useEffect(() => {
    let live = true;

    async function handle(url: string | null) {
      if (!url || !live) return;
      const link = parseAuthLink(url);
      if (link.kind === 'none') return;

      const outcome = await completeAuthLink(link);
      if (live && !outcome.ok) onFailure(outcome.message);
    }

    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      Linking.getInitialURL().then(handle).catch(() => undefined);
    }

    const subscription = Linking.addEventListener('url', (event) => handle(event.url));
    return () => {
      live = false;
      subscription.remove();
    };
  }, [onFailure]);
}
