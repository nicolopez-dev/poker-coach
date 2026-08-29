# Writing lessons

All course content lives in [`src/content/course.ts`](../src/content/course.ts). Add to that
array and the Path rows, the Home CTA, the drill and the mastery bars on You all follow — there
is nothing else to wire up.

The shapes are in [`src/content/types.ts`](../src/content/types.ts); progress is derived in
[`src/content/progress.ts`](../src/content/progress.ts).

## The ladder

Fourteen units in four tiers, and **the tier decides how many questions a lesson asks**:

| Units | Tier | Questions per lesson |
| ----- | ---- | -------------------- |
| 1–4   | Never played before | 4 |
| 5–8   | Getting good        | 5 |
| 9–11  | Advanced            | 6 |
| 12–14 | Pro                 | 6 |

A chapter is either **ten lessons or none** — half-written units aren't a state the Path reads
well. Both rules are enforced by [`course.test.ts`](../src/content/course.test.ts).

All fourteen units are written: 140 lessons, 720 questions. Adding a fifteenth means appending a
chapter and following the same rules; changing an existing one means re-checking every figure it
quotes against [`holdem.test.ts`](../src/lib/holdem.test.ts).

## One format, everywhere

Every scenario is **six-handed no-limit hold'em, €1/€2, €200 stacks** unless the lesson is
explicitly about something else. Sticking to one format is what lets the course quote published
figures without an asterisk on each one — change the format and the correct answers change with
it.

## Numbers have to be computed

Any percentage, price or equity a lesson states must come from
[`src/lib/holdem.ts`](../src/lib/holdem.ts) and be asserted in
[`holdem.test.ts`](../src/lib/holdem.test.ts). Don't write a figure that isn't pinned there — the
whole promise of the app is that the maths is right, and a remembered number is how that promise
breaks. Two figures in the first draft of the syllabus were wrong and the test is what caught
them.

Watch the two that are easy to mix up:

- **What a call needs** is `bet / (pot + 2 × bet)` — 25% against a half-pot bet.
- **Minimum defence frequency** is `pot / (pot + bet)` — 67% against that same bet.

They are not complements of each other.

### Ranges

Opening charts are convention, not arithmetic, so a lesson may not present one as solved. What it
*can* do is quote a range in full and then be exact about how wide that is:

```ts
rangeSize('22+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo'); // 174 combos
rangeShare('22+, A9s+, KTs+, QTs+, JTs, T9s, AJo+, KQo'); // 0.1312 — "13% of hands"
```

Write the chart out in the question's `context` so the reader can see what the percentage is a
percentage *of*, say plainly that good players' charts differ, and pin the count in
`holdem.test.ts`. Never quote a bare "you should open 22% here" with no range behind it.

### Verify showdowns before writing the prose

Any question that says who wins should be run through `evaluate` first. The quickest way is a
throwaway test listing the matchups, which you delete once it is green — writing Unit 2 that way
caught an "ace-rag" hand that quietly made a wheel straight and won the pot it was meant to lose.

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

Rules the test enforces:

- **One deck.** No card appears twice in a question. Write a ten as `'10'`, not `'T'`.
- **`offset: 0` means your hand.** At most two cards sit level, and every board card drops —
  including in a board-only fan, where all of them carry `offset: 10`.
- **Board cards come last**, so offsets never go back up across a fan.
- **Five cards maximum.** That is what the row fits across a narrow phone without clipping.
- **Never show a partial board.** A fan is either *your hand plus a complete flop* (2 + 3) or
  *a complete board on its own* (3, 4 or 5 cards), with the hole cards named in the caption —
  `'The finished board — you hold A♠ 5♠'`. Showing three of five board cards and describing the
  other two in prose is how a reader ends up misreading the hand. `the-game-full-hand` walks a
  hand from preflop to river this way: hole cards alone, then hand + flop, then board only.
- **Every fan is captioned** with `cardsLabel`, and the caption says what the reader is looking at.

Seven-card fans — your hand *and* a full board — need the fan to shrink to fit first, in
[`DrillOverlay.tsx`](../src/screens/DrillOverlay.tsx). Until then the two-fan rule above covers
every street.

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
- Every question's `correct` matches one of its option ids, and no two options share an id.
- Ten lessons in a chapter, or none, and the question count matches the tier.
- Every card fan is one legal deal, complete, captioned, and five cards or fewer.
- Every figure quoted is asserted in [`holdem.test.ts`](../src/lib/holdem.test.ts).
- Wrong answers are mistakes a player would actually make — never a hand the board cannot make.

```bash
npm test
```

[`course.test.ts`](../src/content/course.test.ts) enforces everything on that list a machine can
check, and names the offending lesson and question number when it fails.
