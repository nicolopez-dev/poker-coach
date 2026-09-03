/// <reference types="node" />
/**
 * Points the app at the local Supabase stack by writing `.env.local`.
 *
 * Expo loads `.env.local` ahead of `.env`, so this overrides the hosted project without
 * touching it — and `.env*.local` is gitignored, so it cannot be committed by accident.
 * Delete the file (or `npm run env:hosted`) to go back.
 *
 *   npm run env:local     point at the local stack
 *   npm run env:hosted    forget it and use .env again
 *
 * Restart Metro afterwards: EXPO_PUBLIC_* is inlined at build time, so a running
 * bundler will not pick the change up.
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = resolve(ROOT, '.env.local');

function hosted(): void {
  if (existsSync(ENV_LOCAL)) {
    rmSync(ENV_LOCAL);
    console.log('Removed .env.local — the app is back on the project in .env.');
  } else {
    console.log('No .env.local; the app is already on the project in .env.');
  }
}

function local(): void {
  let status: string;
  try {
    // `-o env` prints API_URL / ANON_KEY / SERVICE_ROLE_KEY as shell assignments.
    // One fixed string, no interpolation — nothing here comes from outside this file.
    status = execSync('npx supabase status -o env', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    throw new Error('Could not read the local stack. Start it first: npx supabase start');
  }

  const read = (key: string): string => {
    const match = new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm').exec(status);
    if (!match) throw new Error(`${key} missing from \`supabase status\` — is the stack up?`);
    return match[1];
  };

  const url = read('API_URL');
  const anon = read('ANON_KEY');

  writeFileSync(
    ENV_LOCAL,
    [
      '# Written by `npm run env:local`. Gitignored, and it overrides .env.',
      '# Remove it, or run `npm run env:hosted`, to go back to the real project.',
      `EXPO_PUBLIC_SUPABASE_URL=${url}`,
      `EXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote .env.local → ${url}`);
  console.log('Restart Metro (npm run web) so the new values are bundled in.');
}

try {
  if (process.argv.includes('--hosted')) hosted();
  else local();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
