import type { Chapter, DrillLesson, Lesson } from './types';

/** Matches the badges on the Path: Mastered · Playing · Up next · Locked. */
export type ChapterState = 'done' | 'now' | 'next' | 'locked';

export type ChapterProgress = {
  chapter: Chapter;
  /** 0-based position in the course; the Path shows it as "Unit {index + 1}" */
  index: number;
  /** lessons finished / lessons written */
  done: number;
  total: number;
  pct: number;
  state: ChapterState;
};

export type LessonRef = {
  chapterId: string;
  lessonId: string;
};

/**
 * Walks the course against the finished lesson ids.
 * The first chapter that has lessons and isn't finished is the current one;
 * the next chapter with lessons after it is up next. Chapters with no lessons
 * written yet read as locked, so the syllabus can be sketched ahead of content.
 */
export function courseProgress(course: Chapter[], completed: string[]): ChapterProgress[] {
  const counts = course.map((chapter) => {
    const total = chapter.lessons.length;
    const done = chapter.lessons.filter((l) => completed.includes(l.id)).length;
    return { total, done };
  });

  const nowIndex = counts.findIndex(({ total, done }) => total > 0 && done < total);
  const nextIndex = counts.findIndex(({ total }, i) => total > 0 && i > nowIndex);

  return course.map((chapter, index) => {
    const { total, done } = counts[index];
    const state: ChapterState =
      total > 0 && done === total
        ? 'done'
        : index === nowIndex
          ? 'now'
          : index === nextIndex
            ? 'next'
            : 'locked';

    return {
      chapter,
      index,
      done,
      total,
      pct: total ? Math.round((done / total) * 100) : 0,
      state,
    };
  });
}

export const isPlayable = (state: ChapterState) => state === 'done' || state === 'now' || state === 'next';

/** The chapter the player is on, or the first one with lessons. */
export function currentChapter(progress: ChapterProgress[]): ChapterProgress | undefined {
  return progress.find((p) => p.state === 'now') ?? progress.find((p) => p.total > 0);
}

/** The first unfinished lesson of a chapter, falling back to its first lesson. */
export function nextLessonOf(
  chapter: Chapter,
  completed: string[],
): LessonRef | undefined {
  const lesson = chapter.lessons.find((l) => !completed.includes(l.id)) ?? chapter.lessons[0];
  return lesson ? { chapterId: chapter.id, lessonId: lesson.id } : undefined;
}

/** Where the player should pick up: the current chapter's next lesson. */
export function nextLesson(course: Chapter[], completed: string[]): LessonRef | undefined {
  const current = currentChapter(courseProgress(course, completed));
  return current ? nextLessonOf(current.chapter, completed) : undefined;
}

export function findChapter(course: Chapter[], chapterId: string): Chapter | undefined {
  return course.find((c) => c.id === chapterId);
}

export function findLesson(course: Chapter[], ref: LessonRef | null): Lesson | undefined {
  if (!ref) return undefined;
  return findChapter(course, ref.chapterId)?.lessons.find((l) => l.id === ref.lessonId);
}

export const isDrill = (lesson: Lesson | undefined): lesson is DrillLesson =>
  lesson?.kind === 'drill';

/** "Unit 2 · Position · 1 of 3" — the kicker above a drill question. */
export function drillKicker(
  chapterIndex: number,
  chapterTitle: string,
  questionIndex: number,
  questionCount: number,
): string {
  return `Unit ${chapterIndex + 1} · ${chapterTitle} · ${questionIndex + 1} of ${questionCount}`;
}
