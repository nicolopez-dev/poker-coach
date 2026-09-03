/**
 * Pushes the answer key from `src/content/course.ts` into `public.content_questions`.
 *
 * docs/accounts-plan.md §5: the server has to own the correct option id, or XP and
 * accuracy are whatever a patched build says they are. That mirror is **generated,
 * never authored** — this script is the only thing that writes it, and hand-editing the
 * table means the next run undoes you.
 *
 *   npm run sync:content
 *
 * Credentials come from `.env.admin` (gitignored), or from SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY already in the environment, which is how you point it at
 * the local stack. The service-role key bypasses RLS and must never reach the app
 * (§3 rule 2).
 */

/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE } from '../src/content/course';
import { answerKey, manifestHash, type AnswerKeyRow } from '../src/content/manifest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_ENV = resolve(ROOT, '.env.admin');
const HASH_FILE = resolve(ROOT, 'src/content/content-hash.json');

/** Rows per request. The course is under a thousand; this is for when it isn't. */
const BATCH = 500;

/**
 * Enough of dotenv to read one file. `KEY=value`, `#` comments, optional quotes —
 * anything fancier belongs in a real dependency, and this file has never needed one.
 */
function readEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    values[match[1]] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return values;
}

function credentials(): { url: string; key: string } {
  const file = readEnvFile(ADMIN_ENV);
  const url = process.env.SUPABASE_URL || file.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || file.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing ${!url ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'}. Put both in ` +
        `.env.admin (see docs/phase-0-setup.md), or set them in the environment to ` +
        `target a different project.`,
    );
  }
  return { url, key };
}

async function main(): Promise<void> {
  const rows = answerKey(COURSE);
  if (rows.length === 0) {
    throw new Error('No drill questions found in COURSE — refusing to empty the mirror.');
  }

  const { url, key } = credentials();
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Syncing ${rows.length} questions to ${url}`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('content_questions')
      .upsert(batch, { onConflict: 'lesson_id,question_index' });
    if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
  }

  // A question deleted from course.ts has to leave the mirror too, or the server keeps
  // marking against a key that no lesson asks any more.
  const { data: stored, error: readError } = await supabase
    .from('content_questions')
    .select('lesson_id, question_index');
  if (readError) throw new Error(`Could not read the mirror back: ${readError.message}`);

  const wanted = new Set(rows.map((row) => `${row.lesson_id}#${row.question_index}`));
  const stale = (stored ?? []).filter(
    (row) => !wanted.has(`${row.lesson_id}#${row.question_index}`),
  );

  const byLesson = new Map<string, number[]>();
  for (const row of stale) {
    byLesson.set(row.lesson_id, [...(byLesson.get(row.lesson_id) ?? []), row.question_index]);
  }

  for (const [lessonId, indexes] of byLesson) {
    const { error } = await supabase
      .from('content_questions')
      .delete()
      .eq('lesson_id', lessonId)
      .in('question_index', indexes);
    if (error) throw new Error(`Could not drop stale rows for ${lessonId}: ${error.message}`);
  }

  writeHash(rows);

  console.log(
    `Synced ${rows.length} questions` +
      (stale.length ? `, dropped ${stale.length} that no lesson asks any more` : '') +
      '.',
  );
}

/** The manifest the build checks against, so an edited lesson cannot ship unsynced. */
function writeHash(rows: AnswerKeyRow[]): void {
  const manifest = {
    hash: manifestHash(rows),
    questions: rows.length,
    generatedBy: 'npm run sync:content',
  };
  writeFileSync(HASH_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
