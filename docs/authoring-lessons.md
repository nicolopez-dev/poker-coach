# Writing lessons

All course content lives in [`src/content/course.ts`](../src/content/course.ts). Add to that
array and the Path rows, the Home CTA, the drill and the mastery bars on You all follow — there
is nothing else to wire up.

The shapes are in [`src/content/types.ts`](../src/content/types.ts); progress is derived in
[`src/content/progress.ts`](../src/content/progress.ts).

## Chapters

A chapter is one row on the Path.

```ts
{
  id: 'pot-odds',              // unique, stable — progress is stored against it
  title: 'Pot odds',           // the row title
  sub: 'The price of a call, in one number',
  glyph: '♦',                  // the suit on the card tile
  lessons: [ /* … */ ],
}
```

A chapter with `lessons: []` reads as **Locked** and is inert, so the whole syllabus can be
sketched up front and filled in later. Order matters: the first chapter that has lessons and
isn't finished is the current one ("Playing"), the next chapter with lessons is "Up next", and
everything else is locked.

## Drill lessons

One lesson is one run of the drill overlay — a handful of questions, 8 XP each, one heart per
wrong answer.

```ts
{
  id: 'pot-odds-basics',       // unique across the whole course
  kind: 'drill',
  title: 'Counting the pot',
  questions: [
    {
      prompt: "Pot's 40. They bet 20. What's it going to be?",
      context: 'You pay 20 to win 60 — that\'s 3-to-1.',
      options: [
        { id: 'a', label: 'Fold, you missed' },
        { id: 'b', label: 'Call, the price is right' },
        { id: 'c', label: 'Raise to 90' },
      ],
      correct: 'b',
      why: 'Your draw lands about a third of the time and the pot only asks for a quarter.',
    },
  ],
}
```

- `prompt` is the big line; keep it to a sentence or two.
- `context` is the quiet line underneath — the table state, the maths, the read.
- `why` shows in the feedback card after answering, right or wrong. Explain the reasoning, don't
  just restate the answer.
- The kicker ("Unit 2 · Position · 1 of 3") is generated — don't write it.

### Showing cards

Add a fan above the context line. Hole cards sit level; give board cards `offset: 10` so they
drop away from the hand.

```ts
cards: [
  { rank: 'A', suit: '♠' },
  { rank: 'K', suit: '♠' },
  { rank: 'Q', suit: '♦', offset: 10 },
],
cardsLabel: 'Your two cards, then the board',
```

## Table lessons (future scope)

Beating a table of AI players is not built yet, but the model is ready for it: `TableLesson` is
part of the `Lesson` union, the course and progress code handle it, and the drill overlay routes
anything that isn't a drill to a placeholder. Adding one today puts a lesson on the Path that
opens that placeholder.

```ts
{
  id: 'position-table',
  kind: 'table',
  title: 'Six-handed, hold your seat',
  goal: 'Finish the hour up on the table.',
  seats: 6,
  startingStack: 2000,
  blinds: [10, 20],
  opponents: [
    { name: 'Ana', style: 'nit' },
    { name: 'Bruno', style: 'station' },
    { name: 'Cass', style: 'aggro' },
  ],
}
```

To build it out: give `TableLesson` whatever the engine needs, then replace the
`LessonPlaceholder` branch in [`src/screens/DrillOverlay.tsx`](../src/screens/DrillOverlay.tsx)
with the table screen.

## Checklist

- Lesson ids are unique across the whole course — progress is keyed on them.
- Every question's `correct` matches one of its option ids.
- `npm test` covers both of those; run it after adding content.
