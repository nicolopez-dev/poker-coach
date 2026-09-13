/**
 * Reading a fan as a hand and a board, checked against the real course.
 *
 * The split is derived rather than authored, so the guard against getting it wrong is
 * that every written question still divides the way `course.test.ts` says it must.
 */
import { boardLabel, hasHeldHand, splitCards } from './cards';
import { COURSE } from './course';
import { isDrill } from './progress';
import type { Question } from './types';

const questions: { at: string; question: Question }[] = COURSE.flatMap((chapter) =>
  chapter.lessons
    .filter(isDrill)
    .flatMap((lesson) => lesson.questions.map((question, i) => ({ at: `${lesson.id} #${i + 1}`, question }))),
);

const tag = (at: string, value: unknown) => `${at} → ${String(value)}`;

describe('splitting a fan', () => {
  it('takes the level cards as the hand and the dropped ones as the board', () => {
    const question = {
      cards: [
        { rank: 'A', suit: '♠' as const },
        { rank: 'K', suit: '♠' as const },
        { rank: 'Q', suit: '♦' as const, offset: 10 as const },
      ],
    } as Question;

    const { hole, board } = splitCards(question);
    expect(hole.map((c) => c.rank)).toEqual(['A', 'K']);
    expect(board.map((c) => c.rank)).toEqual(['Q']);
  });

  it('finds nothing in a question with no fan at all', () => {
    const { hole, board } = splitCards({} as Question);
    expect(hole).toHaveLength(0);
    expect(board).toHaveLength(0);
  });

  it('never claims a hand from more or fewer than two cards', () => {
    for (const { at, question } of questions) {
      const { hole } = splitCards(question);
      expect(tag(at, hasHeldHand(question))).toBe(tag(at, hole.length === 2));
    }
  });

  it('leaves every card in the course on exactly one side of the split', () => {
    for (const { at, question } of questions) {
      const { hole, board } = splitCards(question);
      expect(tag(at, hole.length + board.length)).toBe(tag(at, (question.cards ?? []).length));
    }
  });
});

describe('the board caption, once the hand is drawn below it', () => {
  it('drops a hold the hand now shows', () => {
    expect(boardLabel('The board — you hold A♠ K♥')).toBe('The board');
    expect(boardLabel('The finished board — you hold K♠ Q♠')).toBe('The finished board');
    expect(boardLabel('The board after the turn — you hold J♥ 10♣')).toBe('The board after the turn');
  });

  it('rewrites the captions that opened with the hand', () => {
    expect(boardLabel('Your two cards, then the flop')).toBe('The flop');
    expect(boardLabel('Your cards, then the flop')).toBe('The flop');
  });

  it('leaves a caption that was only ever about the board', () => {
    expect(boardLabel('The flop')).toBe('The flop');
    expect(boardLabel('The finished board')).toBe('The finished board');
  });

  it('keeps context that is not a hold', () => {
    // this question deals one known hole card, so no hand is drawn and the words are
    // the only place the hold appears
    expect(boardLabel('The flop — you raised under the gun')).toBe(
      'The flop — you raised under the gun',
    );
    expect(boardLabel('The flop — you defended the big blind')).toBe(
      'The flop — you defended the big blind',
    );
  });

  it('never leaves a caption talking about a hand that is drawn anyway', () => {
    for (const { at, question } of questions) {
      if (!hasHeldHand(question)) continue;
      const derived = boardLabel(question.cardsLabel) ?? '';
      expect(tag(at, /you hold/i.test(derived))).toBe(tag(at, false));
    }
  });

  it('leaves an absent caption absent', () => {
    expect(boardLabel(undefined)).toBeUndefined();
  });
});
