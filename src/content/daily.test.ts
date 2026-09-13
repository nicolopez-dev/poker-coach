/**
 * The hand of the day, which has to be the *same* hand all day.
 */
import { COURSE } from './course';
import { handOfTheDay } from './daily';
import { isDrill } from './progress';

const written = COURSE.find((c) => c.lessons.length > 0)!;

describe('the hand of the day', () => {
  it('holds still for a whole day', () => {
    expect(handOfTheDay(written, '2026-09-08')).toEqual(handOfTheDay(written, '2026-09-08'));
  });

  it('turns over between days', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    const picks = days.map((d) => handOfTheDay(written, d)?.question.prompt);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('deals a question that is really in the chapter', () => {
    const prompts = new Set(
      written.lessons.filter(isDrill).flatMap((l) => l.questions.map((q) => q.prompt)),
    );
    for (let d = 1; d <= 31; d++) {
      const hand = handOfTheDay(written, `2026-03-${String(d).padStart(2, '0')}`);
      expect(prompts.has(hand!.question.prompt)).toBe(true);
      expect(hand!.chapterTitle).toBe(written.title);
    }
  });

  it('carries the address the server marks against', () => {
    // without these the day's hand could not be answered for real — `submit_answer`
    // finds the key by lesson and index, and the completion needs the chapter
    for (let d = 1; d <= 14; d++) {
      const hand = handOfTheDay(written, `2026-04-${String(d).padStart(2, '0')}`)!;
      const lesson = written.lessons.filter(isDrill).find((l) => l.id === hand.lessonId)!;
      expect(lesson).toBeDefined();
      expect(hand.chapterId).toBe(written.id);
      expect(lesson.questions[hand.questionIndex]).toBe(hand.question);
    }
  });

  it('has no hand when there is no chapter, or nothing written in it', () => {
    expect(handOfTheDay(undefined, '2026-09-08')).toBeNull();
    const empty = COURSE.find((c) => c.lessons.length === 0);
    if (empty) expect(handOfTheDay(empty, '2026-09-08')).toBeNull();
  });
});
