import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureStorage } from './secureStorage';

/**
 * Expo inlines `EXPO_PUBLIC_*` at build time, so a missing value is `undefined` in the
 * bundle and every call fails later as an unexplained 401. Fail at module load instead,
 * naming the variable and how to set it.
 */
function missing(name: string): Error {
  return new Error(
    `Supabase is not configured: ${name} is missing. Copy .env.example to .env and fill in ` +
      `both values from the project's API settings, then restart Metro with --clear — ` +
      `EXPO_PUBLIC_* is baked into the bundle, so a running bundler will not pick it up.`,
  );
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url) throw missing('EXPO_PUBLIC_SUPABASE_URL');
if (!anonKey) throw missing('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // there is no URL to read a session out of on a native app; PKCE carries the code
    // back through the deep link instead
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * The refresh timer only ticks while the app is in front. A backgrounded app cannot be
 * relied on to run timers, and a refresh that fires as the OS suspends the process can
 * rotate the refresh token without storing the new one — which signs the player out.
 */
AppState.addEventListener('change', (status) => {
  if (status === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
