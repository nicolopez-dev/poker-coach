/**
 * Reading a question's card fan as a hand and a board.
 *
 * `Question.cards` has always carried both: the hole cards sit level at the front of
 * the array and the board drops 10px behind them, which `course.test.ts` enforces
 * ("drops the board below the hand, never the other way round", "shows at most two hole
 * cards before the board"). Handoff 02 §2.1 draws the two apart — the board stays in
 * the row under the prompt, the hand is dealt in above the answers — so the split is
 * read out of the data that is already there rather than authored a second time.
 */
import type { FaceCard, Question } from './types';

/** The cards the player is holding, and the ones on the table. */
export function splitCards(question: Question): { hole: FaceCard[]; board: FaceCard[] } {
  const cards = question.cards ?? [];
  return {
    hole: cards.filter((c) => (c.offset ?? 0) === 0),
    board: cards.filter((c) => (c.offset ?? 0) !== 0),
  };
}

/** The hand is only drawn when there are exactly two cards to draw. */
export function hasHeldHand(question: Question): boolean {
  return splitCards(question).hole.length === 2;
}

/**
 * The fan's caption, once the hand is drawn separately below it.
 *
 * Captions were written when one row held everything, so most of them name the hold —
 * "The board — you hold A♠ K♥", "Your two cards, then the flop". With the hand on
 * screen the words are saying what the picture already says, so the caption is trimmed
 * back to the board it now labels.
 *
 * This is derived rather than edited into `course.ts` because the trim is only correct
 * when the hand actually renders: "The flop — you hold A♠ and a red card" belongs to a
 * question with one known hole card, no hand is drawn for it, and the words are the
 * only place that fact appears. Deriving it cannot get that wrong; a hundred hand-edited
 * strings could.
 */
export function boardLabel(label: string | undefined): string | undefined {
  if (!label) return label;
  return label
    .replace(/\s*—\s*you hold\b.*$/i, '')
    .replace(/^your (?:two )?cards, then the /i, 'The ');
}
