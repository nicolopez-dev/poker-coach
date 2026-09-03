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
| `npm run sync:content` | Regenerates the server's answer key from `src/content/course.ts` |
| `npm run env:local` | Points the app at the local Supabase stack (writes `.env.local`) |
| `npm run env:hosted` | Removes `.env.local`, back to the project in `.env` |
| `npx supabase db reset` | Rebuilds the local database from `supabase/migrations/` |
| `npx supabase test db` | pgTAP — the row level security rules |

The two Supabase commands need Docker running and `npx supabase start` done once. `db reset`
drops and replays every migration, so it is the way to check a migration actually applies;
`test db` runs `supabase/tests/*.sql` against the result.

## Layout

```
App.tsx                  root: fonts, felt, tabs, header, overlays
src/
  theme/tokens.ts        colours, type scale, radii, shadows, motion constants
  state/store.tsx        the whole app state as one reducer
  content/
    course.ts            the course — chapters and lessons
    types.ts             Question, DrillLesson, TableLesson, Chapter
    progress.ts          chapter states and where to pick up, derived
  lib/
    chips.ts             chip-fitting solver (greedy + exact DP fallback)
    balance.ts           point-to-unit conversion and the tally
    color.ts             chip luminance, dash and ink
    names.ts             seat-name initials rule
  data/                  chip case defaults, sample profile
  components/            felt, gold frame, chip, ace card, header, tab bar, motion
  screens/               Login, Home, Path, Drill, Chips (+ Result, Balance), You
docs/design-handoff/     the design bundle — read-only reference
docs/authoring-lessons.md  how to add chapters and lessons
```

## Adding lessons

The learning side is the point of the app, so all content lives in
[`src/content/course.ts`](src/content/course.ts) — add chapters and lessons there and the Path
rows, the Home CTA, the drill and the mastery bars follow. Progress is derived from the lesson
ids the player has finished, and a chapter with no lessons written yet reads as locked, so the
whole syllabus can be sketched up front. See
[docs/authoring-lessons.md](docs/authoring-lessons.md).

Two lesson kinds exist. `drill` — multiple-choice questions — is what ships. `table`, beating a
table of AI players, is future scope: the type, the course and the launcher already handle it,
and anything that isn't a drill opens a placeholder until that screen is built.

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

- Content is one lesson of three questions, in Position. The other four chapters are sketched
  and read as locked until lessons are written for them.
- Table lessons against AI players are modelled but not built.
- Streak, XP, accuracy, the week chart and the games list are sample data.
  Nothing persists between launches, progress included.
- Setting up a game does not append to "Your games".
- Seat names live only in the Balance rows.
- Apple sign-in is not wired yet, and profile setup is a placeholder.

## Running against the local stack

`.env` points at the hosted project, so a plain `npm run web` talks to production. To work
against the local Supabase stack instead — Docker running first:

```bash
npx supabase start
```

```bash
npm run env:local
```

Then `npm run web` (restart it if it was already running — `EXPO_PUBLIC_*` is inlined at
build time). `npm run env:hosted` puts it back.

Three things differ from the hosted project, on purpose:

- **Email confirmation is off locally**, so sign-up returns a session immediately and lands on
  profile setup. Hosted has it on, so sign-up ends at "Check your inbox".
- **Sent mail goes to Mailpit**, not to a real inbox: <http://127.0.0.1:54324>. That is where
  the reset link is during local testing.
- **No leaked-password check locally** — see [Passwords](#passwords).

Google sign-in works in neither: it is a native module, so it needs a dev build
(`npx expo prebuild` and `npm run android` / `npm run ios`).

## Accounts

Email and password, password reset, and Google are wired against Supabase; see
[`docs/accounts-plan.md`](docs/accounts-plan.md) for the whole design.

**Google uses the native ID-token flow**, not a browser redirect: Google's own sheet returns a
signed ID token and Supabase verifies it against Google's keys, so no web view and no redirect
sit in the middle. That makes it a native module — **Google sign-in cannot run in Expo Go or on
web**, only in a custom dev build (`npx expo prebuild` then `npm run android` / `npm run ios`).
The button is present on web and reports that it is unavailable rather than crashing.

Three OAuth clients exist (web, iOS, Android) but the app only ever sends the **web** client id
as `webClientId` — that is the audience Supabase checks the token against. The iOS client id is
passed too, because Google needs it to mint the token on that platform; Android is matched by
package name and signing certificate instead, so it needs no id in the app. Client ids are
public and live in `.env`; the web client **secret** belongs only in the Supabase dashboard.

### Passwords

**Ten characters, and nothing else — with leaked-password protection doing the real
work.** Character-class rules were tried and dropped: they wave through `Password1!`,
which satisfies all four classes and sits near the top of every breach list, while
blocking the long passphrases that are actually strong. Supabase checks each candidate
against Have I Been Pwned instead, so the passwords that get accounts taken are the ones
refused.

The split matters for error handling. Length is checked in
[`src/auth/password.ts`](src/auth/password.ts) before the network, so it is answered
while the player is still typing. The breach check can only happen server-side, and
comes back as `weak_password` with `reasons: ['pwned']` — which is why
[`src/auth/errors.ts`](src/auth/errors.ts) reads those reasons rather than the error code
alone. Reading the code alone is what once reported a fourteen-character password as too
short.

Two settings hold this up, and only one of them lives in this repo:

| Where | Setting | Value |
| --- | --- | --- |
| `supabase/config.toml` | `minimum_password_length` | `10` |
| `supabase/config.toml` | `password_requirements` | `""` (empty — length only) |
| Dashboard → Authentication → Sign In / Providers | Minimum password length | `10` |
| Dashboard → Authentication → Sign In / Providers | Password Requirements | *No required characters* |
| Dashboard → Authentication → Sign In / Providers | Prevent use of leaked passwords | **on** |

The leaked-password check has no `config.toml` key, so **the local stack accepts breached
passwords the hosted project refuses** — the one place local is deliberately laxer than
production. Do not "fix" it by adding a character rule locally.

### Account linking

**A Google sign-in joins an existing password account only when both sides have a verified
email.** Supabase links identities that share a confirmed address; where the existing account's
address was never confirmed, it stays a separate user rather than being absorbed — otherwise
anyone able to register an unconfirmed address could later claim it by signing in with Google.

This is Supabase's default and it is the behaviour we want, but it is **dashboard state, not
something this repo can pin**: check Authentication → Providers → Google, and Authentication →
Sign In / Providers, on the hosted project before release. `supabase/config.toml` sets
`enable_manual_linking = false` for the local stack, which is a different setting — it governs
`linkIdentity()` calls, not automatic linking by email.

## Deviations from the handoff

- **Background cards are always aces**, on every tab and on login, rather than the handoff's
  per-tab court ranks.
- **"Deal the stacks" is carmesí** (`#dc143c`) rather than the handoff's `#ff563c`, which is
  still the colour of hearts, the "Playing" badge and the chip tool's focus rings.
- **The Path derives its states from real progress**, so chapters without lessons read as locked
  instead of the handoff's fixed sample states.
- **The Path carries fourteen units, not the handoff's five.** The syllabus runs from never having
  played to river combinatorics, so the row titles and one-liners are the course's rather than the
  handoff's sample copy. The tiers and the format are set out at the top of
  [`src/content/course.ts`](src/content/course.ts).
- **The solver retries for full spread.** Where the prototype could silently deal zero of a
  colour, a fit that leaves one out is retried with one of every denomination reserved, and any
  colour that still can't be dealt is named on the result card.

### React Native equivalents

- **Colour picker** — the web prototype opens the OS `input[type=color]`. React Native has no
  equivalent, so tapping a chip's colour well opens a sheet of the case's own swatches.
- **Header blur** — `backdrop-filter` has no Android equivalent; there the header falls back to a
  more opaque fill.
- **`glow`** — React Native cannot animate a box shadow, so the drill CTA pulses a gold ring
  instead.
- **Week chart** — the day letters sit in their own row rather than overflowing the 74px bar box.
