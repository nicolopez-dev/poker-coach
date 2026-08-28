import { COURSE } from './course';
import {
  courseProgress,
  currentChapter,
  drillKicker,
  findLesson,
  isDrill,
  isPlayable,
  nextLesson,
  nextLessonOf,
  type ChapterState,
} from './progress';
import type { Chapter } from './types';

const chapter = (id: string, lessonIds: string[]): Chapter => ({
  id,
  title: id,
  sub: '',
  glyph: '♠',
  lessons: lessonIds.map((lid) => ({ id: lid, kind: 'drill', title: lid, questions: [] })),
});

describe('courseProgress', () => {
  const course = [chapter('one', ['a', 'b']), chapter('two', ['c']), chapter('three', ['d'])];

  it('starts the player on the first chapter with lessons', () => {
    const p = courseProgress(course, []);
    expect(p.map((c) => c.state)).toEqual(['now', 'next', 'locked']);
    expect(p[0].pct).toBe(0);
  });

  it('counts finished lessons', () => {
    const p = courseProgress(course, ['a']);
    expect(p[0].done).toBe(1);
    expect(p[0].total).toBe(2);
    expect(p[0].pct).toBe(50);
    expect(p[0].state).toBe('now');
  });

  it('masters a chapter and moves on', () => {
    const p = courseProgress(course, ['a', 'b']);
    expect(p.map((c) => c.state)).toEqual(['done', 'now', 'next']);
  });

  it('locks chapters that have no lessons written yet', () => {
    const sketched = [chapter('one', ['a']), chapter('empty', []), chapter('three', ['d'])];
    const p = courseProgress(sketched, []);
    expect(p[1].state).toBe('locked');
    expect(p[1].total).toBe(0);
    expect(p[1].pct).toBe(0);
    // the empty chapter is skipped when working out what comes next
    expect(p[2].state).toBe('next');
  });

  it('keeps every chapter done once the course is finished', () => {
    const p = courseProgress(course, ['a', 'b', 'c', 'd']);
    expect(p.every((c) => c.state === 'done')).toBe(true);
    expect(currentChapter(p)?.chapter.id).toBe('one');
  });

  it('only opens chapters that are done, current or up next', () => {
    const open: ChapterState[] = ['done', 'now', 'next'];
    expect(open.every(isPlayable)).toBe(true);
    expect(isPlayable('locked')).toBe(false);
  });
});

describe('picking the next lesson', () => {
  const course = [chapter('one', ['a', 'b'])];

  it('is the first unfinished lesson of the current chapter', () => {
    expect(nextLesson(course, [])).toEqual({ chapterId: 'one', lessonId: 'a' });
    expect(nextLesson(course, ['a'])).toEqual({ chapterId: 'one', lessonId: 'b' });
  });

  it('replays the first lesson once a chapter is finished', () => {
    expect(nextLessonOf(course[0], ['a', 'b'])).toEqual({ chapterId: 'one', lessonId: 'a' });
  });

  it('has nothing to offer an empty course', () => {
    expect(nextLesson([], [])).toBeUndefined();
    expect(nextLessonOf(chapter('empty', []), [])).toBeUndefined();
  });
});

describe('the shipped course', () => {
  it('has a lesson to play', () => {
    const ref = nextLesson(COURSE, []);
    expect(ref).toBeDefined();
    expect(isDrill(findLesson(COURSE, ref!))).toBe(true);
  });

  it('gives every lesson a unique id', () => {
    const ids = COURSE.flatMap((c) => c.lessons.map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every drill question a correct option', () => {
    for (const chapter of COURSE) {
      for (const lesson of chapter.lessons) {
        if (!isDrill(lesson)) continue;
        expect(lesson.questions.length).toBeGreaterThan(0);
        for (const q of lesson.questions) {
          expect(q.options.some((o) => o.id === q.correct)).toBe(true);
        }
      }
    }
  });
});

describe('drillKicker', () => {
  it('reads like the design', () => {
    expect(drillKicker(1, 'Position', 0, 3)).toBe('Unit 2 · Position · 1 of 3');
  });
});
