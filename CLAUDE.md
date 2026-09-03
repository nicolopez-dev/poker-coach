# Poker Coach — working notes

Expo SDK 57 / React Native 0.86 app built from a Claude Design handoff. Read
[README.md](README.md) first for what the product is and how to run it.

## The design handoff is the spec

`docs/design-handoff/` is the delivered bundle — **treat it as read-only**. When a screen needs
changing, check `docs/design-handoff/README.md` first: it carries the exact colours, type scale,
radii, spacing, motion timings and copy, and `screens/*.png` are 2× captures to compare against.
`Poker Coach v3 felt.dc.html` is the design to implement; v1/v2 and `support.js` are context only
and must not be ported.

Every value in `src/theme/tokens.ts` comes from that README. Add new design values there rather
than inline, and keep the names the handoff uses (`reward`, `gold hairline`, `felt`, `surface`).

The design has since been taken further in a few places — always aces in the background, a
carmesí "Deal the stacks", and a Path driven by real progress. Those are listed under
"Deviations from the handoff" in the README; keep that list current when the design and the app
part ways again.

## Content

Lessons are the product. Content lives in `src/content/course.ts` and nothing else should hold
course data — the screens derive everything from it through `src/content/progress.ts`.
`docs/authoring-lessons.md` is the guide for adding chapters and lessons, so keep it accurate
when the content model changes.

The server keeps its own copy of the answer key in `content_questions`, so `submit_answer`
decides right or wrong rather than trusting the client. That table is a **generated mirror,
never hand-edited** — `scripts/sync-content.ts` extracts it from `COURSE`. Editing a question
means re-running `npm run sync:content`, and `course.test.ts` fails the build against
`src/content/content-hash.json` until you do. See `docs/accounts-plan.md` §5.

The course is fourteen units of ten lessons, all of it six-handed no-limit hold'em at €1/€2 with
€200 stacks. **Never write a number into a lesson that isn't computed in `src/lib/holdem.ts` and
asserted in `holdem.test.ts`** — a remembered equity is how the app stops being trustworthy.
`src/content/course.test.ts` fails the build on a card dealt twice, a partial or oversized card
fan, or a lesson with the wrong number of questions for its tier.

`Lesson` is a union: `drill` today, `table` (beating a table of AI players) reserved for later.
Anything switching on `lesson.kind` must stay total over both.

## Conventions

- **Colour semantics matter.** Red is only for the chip action, hearts, the "Playing" badge and
  chip-tool focus rings. "Good" states are near-black + white text + a 1px gold hairline
  (`GoldFrame`), never green fills. Green is felt/surfaces and thin progress fills.
- **Suit pips render in the platform font** via `<Suit>` — Archivo ships no card glyphs, and a
  missing glyph in a named family is tofu on Android.
- **Letter spacing** is in em in CSS and points in RN: use `ls(fontSize, em)`.
- Shared primitives live in `src/components/ui.tsx`; screens keep their own `StyleSheet`.

## React Native gotchas hit here

- Use `boxShadow: '0 1px 2px rgba(0,0,0,.45)'` (the CSS string from the handoff), not the
  deprecated `shadow*` props.
- `pointerEvents` goes in `style`, not as a prop.
- `StyleSheet.absoluteFillObject` is gone from the RN 0.86 types — use `absoluteFill` from
  `src/theme/tokens.ts` when spreading into a style object.
- `Animated.interpolate` needs an ascending `inputRange`; reverse an animation by swapping the
  **outputRange** (see `Tilt`).
- Animation is the built-in `Animated` API on purpose — it needs no babel plugin and works on web.
  Loops pass `useNativeDriver: Platform.OS !== 'web'`.

## Before finishing a change

```bash
npm run typecheck
```

```bash
npm test
```

The tests cover the chip solver and the Balance maths — the two things that must not drift from
the handoff. Keep them passing when touching `src/lib/`.

## Editing files on Windows

Do not pipe source files through PowerShell `Get-Content` / `Set-Content` to do bulk edits: the
default encodings mangle the em dashes and suit glyphs that are all over this codebase. Use the
editing tools.
