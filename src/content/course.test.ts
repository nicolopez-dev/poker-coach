/**
 * The course, checked as content rather than as code.
 *
 * Lessons are the product, so the things a reader would call "obviously
 * broken" are the things worth failing a build over: a card dealt twice, a
 * board that never existed, an answer that isn't on the list.
 *
 * The maths the lessons quote is pinned separately, in src/lib/holdem.test.ts.
 *
 * Assertions compare `label: value` strings so a failure names the lesson and
 * the question rather than just the number that came out wrong.
 */
import { COURSE } from './course';
import manifest from './content-hash.json';
import { answerKey, manifestHash } from './manifest';
import { isDrill } from './progress';
import type { DrillLesson, Question } from './types';
import { RANKS, SUITS, toCard } from '../lib/holdem';

/** Questions per lesson by tier — the ladder set out in course.ts. */
const questionsForUnit = (index: number): number => (index < 4 ? 4 : index < 8 ? 5 : 6);

/** Five is what the drill's card fan fits across a phone without clipping. */
const MAX_FAN = 5;

const drills: { unit: number; lesson: DrillLesson }[] = COURSE.flatMap((chapter, unit) =>
  chapter.lessons.filter(isDrill).map((lesson) => ({ unit, lesson })),
);

const questions: { at: string; question: Question }[] = drills.flatMap(({ lesson }) =>
  lesson.questions.map((question, i) => ({ at: `${lesson.id} #${i + 1}`, question })),
);

/** `expect(got(at, x)).toBe(want(at, y))` — same check, readable failure. */
const tag = (at: string, value: unknown) => `${at} → ${String(value)}`;

describe('the syllabus', () => {
  it('is fourteen units', () => {
    expect(COURSE).toHaveLength(14);
  });

  it('gives every chapter a unique id', () => {
    const ids = COURSE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('writes chapters as ten lessons, or leaves them sketched', () => {
    for (const chapter of COURSE) {
      expect(tag(chapter.id, chapter.lessons.length)).toBe(
        tag(chapter.id, chapter.lessons.length === 0 ? 0 : 10),
      );
    }
  });

  it('has at least one unit written', () => {
    expect(COURSE.some((c) => c.lessons.length > 0)).toBe(true);
  });

  it("asks the tier's number of questions in every written lesson", () => {
    for (const { unit, lesson } of drills) {
      expect(tag(lesson.id, lesson.questions.length)).toBe(tag(lesson.id, questionsForUnit(unit)));
    }
  });
});

describe('every question', () => {
  it('offers a real answer, and only distinct options', () => {
    for (const { at, question } of questions) {
      const ids = question.options.map((o) => o.id);
      expect(tag(at, new Set(ids).size)).toBe(tag(at, ids.length));
      expect(tag(at, ids.includes(question.correct))).toBe(tag(at, true));
      expect(tag(at, question.options.length >= 2)).toBe(tag(at, true));
    }
  });

  it('explains itself', () => {
    for (const { at, question } of questions) {
      expect(tag(at, question.prompt.trim().length > 0)).toBe(tag(at, true));
      expect(tag(at, question.context.trim().length > 0)).toBe(tag(at, true));
      // the feedback card has to say more than the option label already did
      expect(tag(at, question.why.trim().length > 40)).toBe(tag(at, true));
    }
  });
});

describe('the cards on screen', () => {
  it('deals every fan from one deck', () => {
    for (const { at, question } of questions) {
      if (!question.cards) continue;
      const dealt = question.cards.map(toCard);
      expect(tag(at, new Set(dealt).size)).toBe(tag(at, dealt.length));
    }
  });

  it('only shows ranks and suits that exist', () => {
    const legalRanks = new Set([...RANKS.replace('T', ''), '10']);
    for (const { at, question } of questions) {
      for (const card of question.cards ?? []) {
        const face = `${at} ${card.rank}${card.suit}`;
        expect(tag(face, legalRanks.has(card.rank))).toBe(tag(face, true));
        expect(tag(face, SUITS.includes(card.suit))).toBe(tag(face, true));
        expect(() => toCard(card)).not.toThrow();
      }
    }
  });

  it('fits the fan across a phone', () => {
    for (const { at, question } of questions) {
      if (!question.cards) continue;
      const n = question.cards.length;
      expect(tag(at, n >= 1 && n <= MAX_FAN)).toBe(tag(at, true));
    }
  });

  it('drops the board below the hand, never the other way round', () => {
    for (const { at, question } of questions) {
      const offsets = (question.cards ?? []).map((c) => c.offset ?? 0);
      expect(tag(at, offsets.join(','))).toBe(tag(at, [...offsets].sort((a, b) => a - b).join(',')));
    }
  });

  it('shows at most two hole cards before the board', () => {
    for (const { at, question } of questions) {
      if (!question.cards) continue;
      const hole = question.cards.filter((c) => (c.offset ?? 0) === 0).length;
      expect(tag(at, hole <= 2)).toBe(tag(at, true));
    }
  });

  it('captions every fan', () => {
    for (const { at, question } of questions) {
      if (!question.cards) continue;
      expect(tag(at, Boolean(question.cardsLabel?.trim()))).toBe(tag(at, true));
    }
  });
});

describe('the answer key mirror', () => {
  /**
   * `content_questions` is what the server marks answers against (§5). If a lesson is
   * edited and the mirror is not re-synced, `submit_answer` keeps grading against the
   * old key — silently, and only for real users. So the build fails instead.
   */
  const STALE = 'the answer key has changed — run `npm run sync:content`';

  it('matches the manifest the server was last synced to', () => {
    const rows = answerKey(COURSE);
    expect(tag(STALE, rows.length)).toBe(tag(STALE, manifest.questions));
    expect(tag(STALE, manifestHash(rows))).toBe(tag(STALE, manifest.hash));
  });

  it('carries one row per drill question, and none for a table lesson', () => {
    expect(answerKey(COURSE)).toHaveLength(questions.length);
  });

  it('names an option the question actually offers', () => {
    for (const row of answerKey(COURSE)) {
      const at = `${row.lesson_id} #${row.question_index + 1}`;
      expect(tag(at, row.option_ids.includes(row.correct_option_id))).toBe(tag(at, true));
    }
  });

  it("is keyed uniquely, as the table's primary key requires", () => {
    const keys = answerKey(COURSE).map((row) => `${row.lesson_id}#${row.question_index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
