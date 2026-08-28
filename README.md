# Poker Coach

A mobile poker **utility** — not a game. Two pillars:

1. **Lessons**, Duolingo-style — a unit path, short multiple-choice drills, streak, XP, hearts.
2. **Chip counter** — a setup tool for a real, physical home game. Enter the chips you own
   (colour, quantity, value), the number of players and the entry bet in units; the app deals an
   equal stack per player, picks the denominations, and converts end-of-game point counts back
   into units in the **Balance** section.

There is no live game tracking and no real money. Stakes are abstract "units";
**1 unit = 100 points, always**.

Built from the Claude Design handoff in [`docs/design-handoff/`](docs/design-handoff) — v3 "felt":
dark felt ground, table-green surfaces, rewards in near-black with a 1px gold hairline, red kept
for the one chip action and for hearts.

## Stack

- **Expo SDK 57** / React Native 0.86 / React 19 — iOS, Android and web from one codebase
- TypeScript, strict
- `react-native-svg` for the felt, court cards, chips and icons; `expo-linear-gradient` for the
  gold hairline; `expo-blur` for the header
- Animation on React Native's built-in `Animated` — no Reanimated, so no extra native config
- State in a single `useReducer` store (`src/state/store.tsx`) — no navigation library; the four
  tabs and the two overlays are plain conditional renders, matching the prototype

## Getting started

**Node 20.19.4+ (or 22.13+) is required** by React Native 0.86. Older versions print a warning
and may fail to bundle.

```bash
npm install
```

```bash
npm run web
```

`npm run ios` / `npm run android` build for a device or simulator; `npm start` opens the Expo
dev menu. The layout is authored at 390 × 844 (iPhone 14-class) and caps at 480px wide on
tablets and desktop.

| Script | What it does |
| --- | --- |
| `npm run web` | Expo dev server, opened in a browser |
| `npm start` | Expo dev server (pick a target) |
| `npm test` | Jest — the chip solver and Balance maths |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
App.tsx                  root: fonts, felt, tabs, header, overlays
src/
  theme/tokens.ts        colours, type scale, radii, shadows, motion constants
  state/store.tsx        the whole app state as one reducer
  lib/
    chips.ts             chip-fitting solver (greedy + exact DP fallback)
    balance.ts           point-to-unit conversion and the tally
    color.ts             chip luminance, dash and ink
    names.ts             seat-name initials rule
  data/                  questions, course units, chip case, sample profile
  components/            felt, gold frame, chip, court card, header, tab bar, motion
  screens/               Login, Home, Path, Drill, Chips (+ Result, Balance), You
docs/design-handoff/     the design bundle — read-only reference
```

### The algorithms

Both are ported closely from the prototype and covered by tests:

- **Chip assignment** (`src/lib/chips.ts`) — sort colours by value, work out per-player
  availability, then seed a weighted spread and repair it chip by chip. If that misses, a bounded
  DP finds an exact stack and breaks the big chips down until the stack is playable (≥ 20 chips).
  In Auto mode four denomination ladders are tried and the friendliest fit wins.
- **Balance** (`src/lib/balance.ts`) — `scale = entry / dealtStack`; a seat's end count converts
  at that rate, and the difference against the entry is their balance in points and units.

## What isn't built yet

Carried over from the handoff's own open items:

- Lessons content is three questions in one unit; the other four units are placeholders.
- Streak, XP, accuracy, the week chart, mastery percentages and the games list are sample data.
  Nothing persists between launches.
- Setting up a game does not append to "Your games".
- Seat names live only in the Balance rows.
- No sign-up, password reset, or real Google OAuth — every login button authenticates.

## Deviations from the prototype

- **Colour picker** — the web prototype opens the OS `input[type=color]`. React Native has no
  equivalent, so tapping a chip's colour well opens a sheet of the case's own swatches.
- **Header blur** — `backdrop-filter` has no Android equivalent; there the header falls back to a
  more opaque fill.
- **`glow`** — React Native cannot animate a box shadow, so the drill CTA pulses a gold ring
  instead.
- **Week chart** — the day letters sit in their own row rather than overflowing the 74px bar box.
