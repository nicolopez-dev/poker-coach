import type { Chapter } from './types';

/**
 * The course. Add chapters here, and lessons inside them — everything else
 * (the Path rows, the Home CTA, mastery on You, drill progress) derives from
 * this array. See docs/authoring-lessons.md for the shape of each lesson.
 *
 * A chapter with no lessons yet reads as locked, so it is safe to sketch the
 * whole syllabus up front and fill it in over time.
 */
export const COURSE: Chapter[] = [
  {
    id: 'hand-ranks',
    title: 'Hand ranks',
    sub: 'What beats what, no memorising',
    glyph: '♠',
    lessons: [],
  },
  {
    id: 'position',
    title: 'Position',
    sub: 'Why the last seat to act prints money',
    glyph: '♥',
    lessons: [
      {
        id: 'position-basics',
        kind: 'drill',
        title: 'Where you sit',
        questions: [
          {
            prompt: "You're first to act before the flop. Where are you sitting?",
            context: "Six-handed. You're one seat left of the big blind.",
            options: [
              { id: 'a', label: 'Under the gun' },
              { id: 'b', label: 'The cutoff' },
              { id: 'c', label: 'The button' },
            ],
            correct: 'a',
            why: "Under the gun, with five players still to act behind you. Worst seat in the house — open tight and don't be a hero.",
          },
          {
            prompt: 'How good is this, really?',
            cards: [
              { rank: 'A', suit: '♠' },
              { rank: 'K', suit: '♠' },
              { rank: 'Q', suit: '♦', offset: 10 },
              { rank: 'J', suit: '♦', offset: 10 },
              { rank: '4', suit: '♠', offset: 10 },
            ],
            cardsLabel: 'Your two cards, then the board',
            context: 'You hold A♠ K♠. The board came Q♦ J♦ 4♠.',
            options: [
              { id: 'a', label: 'A made straight' },
              { id: 'b', label: 'Two overcards and a flush draw' },
              { id: 'c', label: 'Nothing — give it up' },
            ],
            correct: 'b',
            why: "No pair yet, but two live overcards and four spades to come. That's a hand you keep betting, not one you check down.",
          },
          {
            prompt: "Pot's 40. They bet 20. What's it going to be?",
            context:
              "You pay 20 to win 60 — that's 3-to-1, so you need to win about one time in four.",
            options: [
              { id: 'a', label: 'Fold, you missed' },
              { id: 'b', label: 'Call, the price is right' },
              { id: 'c', label: 'Raise to 90' },
            ],
            correct: 'b',
            why: 'Your draw lands about a third of the time and the pot only asks for a quarter. Easy call — save the raise for when it hits.',
          },
        ],
      },
    ],
  },
  {
    id: 'pot-odds',
    title: 'Pot odds',
    sub: 'The price of a call, in one number',
    glyph: '♦',
    lessons: [],
  },
  {
    id: 'bet-sizing',
    title: 'Bet sizing',
    sub: 'Small, big, and when to shove it',
    glyph: '♣',
    lessons: [],
  },
  {
    id: 'reading-the-table',
    title: 'Reading the table',
    sub: 'Patterns beat tells, every time',
    glyph: '♠',
    lessons: [],
  },
];

/**
 * Progress the app starts with, as lesson ids. Empty means a clean slate;
 * nothing is persisted between launches yet.
 */
export const SEED_COMPLETED: string[] = [];
