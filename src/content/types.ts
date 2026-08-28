/**
 * The course content model.
 *
 * The learning side is the point of the app, so content lives apart from the
 * screens that render it: add chapters and lessons in `course.ts` and the Path,
 * Home and You screens follow automatically. See docs/authoring-lessons.md.
 */

export type Suit = '♠' | '♥' | '♦' | '♣';

/** A card in a question's fan. Hole cards sit level; the board drops 10px. */
export type FaceCard = {
  rank: string;
  suit: Suit;
  offset?: 0 | 10;
};

export type Option = {
  id: string;
  label: string;
};

export type Question = {
  prompt: string;
  /** optional card fan above the context line */
  cards?: FaceCard[];
  /** caption under the fan */
  cardsLabel?: string;
  context: string;
  options: Option[];
  /** id of the correct option */
  correct: string;
  /** shown in the feedback card after answering, right or wrong */
  why: string;
};

/** Multiple-choice drill — the only lesson kind that ships today. */
export type DrillLesson = {
  id: string;
  kind: 'drill';
  title: string;
  questions: Question[];
};

/** How an AI seat plays, for table lessons. */
export type OpponentStyle = 'nit' | 'station' | 'aggro' | 'balanced';

export type Opponent = {
  name: string;
  style: OpponentStyle;
};

/**
 * Future scope: beat a table of AI players. Nothing renders these yet beyond a
 * placeholder — the type exists so the course, progress and drill launcher are
 * already shaped for them.
 */
export type TableLesson = {
  id: string;
  kind: 'table';
  title: string;
  /** what the player has to do to pass */
  goal: string;
  seats: number;
  /** points each seat starts with */
  startingStack: number;
  /** small / big blind, in points */
  blinds: [number, number];
  opponents: Opponent[];
};

export type Lesson = DrillLesson | TableLesson;

export type Chapter = {
  id: string;
  title: string;
  /** one line under the title on the Path */
  sub: string;
  /** the suit on the chapter's card tile */
  glyph: Suit;
  /** empty until content is written — the chapter then reads as locked */
  lessons: Lesson[];
};

/** XP for a correct answer. */
export const XP_PER_ANSWER = 8;
