/**
 * The answer key, extracted from the course.
 *
 * `content_questions` is the one place course data lives outside `course.ts`, and
 * docs/accounts-plan.md §5 is why that does not break the rule: it is **generated,
 * never authored**. This module is the generator — it holds no content of its own, only
 * the projection from `COURSE` down to what the server needs to mark an answer.
 *
 * Build-time only: `scripts/sync-content.ts` and `course.test.ts` import it, the app
 * never does. It reaches for `node:crypto`, which Metro would not thank it for.
 */

// This and scripts/sync-content.ts are the only Node-side TypeScript in an app that is
// otherwise React Native, and tsconfig pulls in no ambient node types — so each asks for
// them itself rather than leaning on the other having done it.
/// <reference types="node" />
import { createHash } from 'node:crypto';

import { isDrill } from './progress';
import type { Chapter } from './types';

/** One row of `public.content_questions`, named as the columns are. */
export type AnswerKeyRow = {
  chapter_id: string;
  lesson_id: string;
  question_index: number;
  correct_option_id: string;
  option_ids: string[];
};

/**
 * Every drill question in the course, sorted by its primary key.
 *
 * `Lesson` is a union of two members and this has to stay total over both: a table
 * lesson has no questions to mark, so it contributes no rows — not an empty row, and
 * not a throw.
 */
export function answerKey(course: Chapter[]): AnswerKeyRow[] {
  const rows = course.flatMap((chapter) =>
    chapter.lessons.filter(isDrill).flatMap((lesson) =>
      lesson.questions.map((question, index) => ({
        chapter_id: chapter.id,
        lesson_id: lesson.id,
        question_index: index,
        correct_option_id: question.correct,
        option_ids: question.options.map((option) => option.id),
      })),
    ),
  );

  return rows.sort(
    (a, b) =>
      a.lesson_id.localeCompare(b.lesson_id) || a.question_index - b.question_index,
  );
}

/**
 * The rows as one canonical string. Sorted and field-separated, so the hash tracks what
 * the server will actually hold and not how `course.ts` happens to be laid out —
 * reordering two chapters is not a content change.
 */
export function manifestSource(rows: AnswerKeyRow[]): string {
  return rows
    .map((row) =>
      [
        row.chapter_id,
        row.lesson_id,
        row.question_index,
        row.correct_option_id,
        row.option_ids.join(','),
      ].join('\t'),
    )
    .join('\n');
}

/** A stable fingerprint of the extracted rows, recorded in `content-hash.json`. */
export function manifestHash(rows: AnswerKeyRow[]): string {
  return createHash('sha256').update(manifestSource(rows), 'utf8').digest('hex');
}
