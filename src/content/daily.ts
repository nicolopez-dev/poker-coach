/**
 * The hand of the day.
 *
 * Home offers one question a day outside the path — a taster, not a lesson. It is drawn
 * from the unit the player is on, so it can neither spoil a unit they have not reached
 * nor ask something the course has not taught them yet.
 *
 * The pick is a function of the date, which is what makes it "the" hand of the day: it
 * stays the same all day, across restarts and tab changes, and turns over at midnight
 * without anything being stored.
 */
import { isDrill } from './progress';
import type { Chapter, Question } from './types';

/**
 * A question, and enough to say where it came from — and to mark it.
 *
 * `lessonId` and `questionIndex` are its address in `content_questions`, which is what
 * lets the day's hand be answered for real rather than played at: the server marks it
 * against the same key it marks the lesson's own copy against.
 */
export type DailyHand = {
  question: Question;
  lessonId: string;
  chapterId: string;
  questionIndex: number;
  chapterTitle: string;
};

/** Stable, well-spread hash of a `YYYY-MM-DD` day. */
function hashDay(day: string): number {
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * One question from this chapter, chosen by the date.
 *
 * Returns null for a chapter with nothing written in it yet, which is the same answer
 * as "there is no hand today" — Home simply does not draw the card.
 */
export function handOfTheDay(chapter: Chapter | undefined, day: string): DailyHand | null {
  if (!chapter) return null;

  const pool = chapter.lessons
    .filter(isDrill)
    .flatMap((lesson) =>
      lesson.questions.map((question, questionIndex) => ({
        question,
        lessonId: lesson.id,
        questionIndex,
      })),
    );

  if (pool.length === 0) return null;

  const pick = pool[hashDay(day) % pool.length];
  return { ...pick, chapterId: chapter.id, chapterTitle: chapter.title };
}
