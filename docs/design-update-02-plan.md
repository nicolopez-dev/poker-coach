# Design handoff update 02 — implementation plan

Written 2026-09-08 against `Poker app with lessons and chip counter (1).zip`
(`design_handoff_poker_coach_update_02/`).

This file is the running order for landing update 02. It exists because the update **cannot be
applied as written** — see "The missing middle" below. Read this before opening the update's own
README, and keep it current as phases land.

---

## 0 · What the package contains

```
design_handoff_poker_coach_update_02/
  README.md                        the delta spec — screen by screen, "was" → "now"
  design/Poker Coach v3 felt.dc.html   the FULL post-update prototype (1,560 lines)
  design/support.js                prototype runtime — context only, never ported
  design/joker-face.png            160×200 cover mark for Hand of the day
  screens/01-drill-held-cards.png
  screens/02-chips-entry-bet.png
  screens/03-you-stats-rank.png
```

Affected screens per the update: **Home**, **Drill**, **Chips (setup + Balance)**, **You**.
Unaffected: Login, Path.

---

## 1 · The missing middle (read this first)

The update's README describes deltas from an intermediate design the app **never received**. The
repo is still at package 01. Concretely, update 02 says things like:

| Update 02 says | Repo actually has |
| --- | --- |
| §1.1 rename `Today's ante` → `Today's streak` | `Today's hand` — no "ante" copy anywhere |
| §1.2 add a spade to the streak card's **front face** | no streak card, no flip, no faces |
| §1.4 "the flat 56px chip circle is replaced by the 3D chip" | no rank card on Home at all |
| §1.5 "previously the question card was visible immediately" | no Hand of the day card at all |
| §5.1 "one chip component, shared with Home" | no ranks in the product at any level |

`grep -ic ante docs/design-handoff/README.md` → 0. `grep -ri "hand of the day" src` → nothing.
The repo's `docs/design-handoff/Poker Coach v3 felt.dc.html` is 1,014 lines; the new one is 1,560.

**The gap is Home-only.** Drill, Chips and You are fully specified by update 02's README — their
"was" states do match the repo. Home is the one screen where update 02 patches a design that was
never built, and Home in the new prototype is effectively a **full rewrite**:

Gone: the `Today's hand` hero · the `Deal me in` reward button · the 2-up quick grid ·
the stat pills · the coach note · the week bar chart.

New, and documented **only as inline CSS in the prototype** — no README prose:
- `Your run` header + `N days at the table` + streak line
- the week as **seven playing cards**, one per day, each tappable
- the streak card itself: chip row, headline, cream CTA, flip to a **How the streak works** back
  face, two-dot toggle beneath
- the `Your rank` card container
- `Pick a table` + `See all` + a horizontal **tables carousel**
- a `Side bet: three in a row` card (where the coach note was)
- a `Playing tonight?` strip (where the chips tile was)

### Decision 1 — do you want the middle package? · **RESOLVED 2026-09-08: build from the prototype**

No middle package will be requested. The new prototype's inline styles are exact and
self-sufficient, and it runs locally — `npm run` the `prototype` config in `.claude/launch.json`
(static server on :8090) and open `Poker Coach v3 felt.dc.html`, which renders fully interactive.
Copy decisions Home needs and the prototype does not answer are ours to write.

Home's target state, confirmed against the running prototype:

- `Your run` · `7 days at the table` · a line about the run
- the week as seven cards — days played read face-up with a rank and suit, days missed show a
  green striped back, the last card is captioned `TODAY`
- the streak card: `TODAY'S STREAK` + `2 of 5 drills` in gold, a row of five chips (paid ones
  filled gold, the rest empty rings), the headline, and a **cream** CTA `Keep dealing — Position`
  with a black disc + gold spade. Big ♠ watermark right, vertically centred. Two dots + `SWIPE OR
  TAP TO FLIP` beneath — note the prototype accepts **tap as well as swipe** on this card
- Hand of the day cover: `#1d4433`, silver hairline, joker bottom-right, `FLIP TO PLAY →`
- `YOUR RANK` card: 3D chip + `Green chip` + green bar + `760 XP to Blue chip`
- `PICK A TABLE` / `SEE ALL` + carousel — mastered / in-progress (maroon) / locked (striped back)
- `Side bet: three in a row` — red card, three dots, one filled
- `Playing tonight?` strip, last element on the screen

Either way the new prototype HTML is the **authoritative full-state spec**; update 02's README is
the authority for exact values on the parts it covers.

---

## 2 · What is cheaper than it looks

**Drill held cards (§2.1) is not a content migration.** `Question.cards` already encodes hole cards
as the leading `offset: 0` entries — `src/content/types.ts` says so ("Hole cards sit level; the
board drops 10px"), and `course.test.ts` already enforces *drops the board below the hand, never the
other way round* and *shows at most two hole cards before the board*. So `hole` is **derivable**:

```ts
const hole = (q.cards ?? []).filter((c) => (c.offset ?? 0) === 0);   // render when length === 2
const board = (q.cards ?? []).filter((c) => (c.offset ?? 0) !== 0);
```

Derive it in the renderer. **Do not restructure `course.ts`.**

**Re-captioning does not touch the content hash.** `manifestSource()` in `src/content/manifest.ts`
hashes only `chapter_id · lesson_id · question_index · correct_option_id · option_ids`.
`cardsLabel` is not in it. So editing the ~100 captions needs **no `npm run sync:content`** and
`content-hash.json` stays valid. Do not re-sync "just in case" — a needless re-sync is a diff
nobody can review.

Captions today (185 questions carry a fan):

| Count | Caption |
| --- | --- |
| 51 | `Your two cards, then the flop` |
| 32 | `Your two cards` ← **no board cards at all** |
| 29 | `The flop` |
| 11 | `The finished board` |
| ~50 | `The board — you hold A♠ K♥` and friends — the "you hold" half becomes redundant |

---

## 3 · What is more expensive than it looks

### 3a · The 3D rank chip (§5.1) — highest risk in the update

The spec is CSS 3D: `transform-style: preserve-3d`, two `backface-visibility: hidden` faces at
`translateZ(5px)`, and a **24-segment milled rim** at `rotateZ(i*15deg) translateX(36px)
rotateY(90deg)`, over a `repeating-conic-gradient` ground.

React Native has **no `transform-style: preserve-3d`** and **no conic gradient**. Nested 3D children
do not composite — the rim segments will collapse flat. What does work: `backfaceVisibility:
'hidden'` on two absolutely-positioned faces with the parent carrying `perspective` + `rotateY`
(the flip is fine), and `react-native-svg` 15.15.4 is already a dependency, which can draw the
milled ring as a segmented arc.

**Spike this before building anything on it** (Phase 2), and record the outcome as a deviation.

Also: the idle spin is specced as `ry += 1.1deg` every 55ms. Do **not** implement that as a
`setInterval` on two mounted components — it pins the JS thread and defeats `useNativeDriver`. Use
one `Animated.loop` per instance, native-driven, per the house rule in CLAUDE.md.

Drag is `PanResponder` — the project has neither `react-native-gesture-handler` nor `reanimated`,
by design.

### 3b · Settling a game (§4.3) collides with the roadmap

§4.3: *"Settling saves the game to Your games and increments the games counter."*

But `GAMES` in `src/data/profile.ts` is **sample data**, `games` comes from the server's
`get_state()` and is **0 for everyone until P19**, and `docs/accounts-plan.md` §P19 is a whole
backend phase (`games` / `game_seats` tables, RLS, an outbox event kind, YouScreen reading real
rows). The update's author had no way to know that.

This repo's standing rule is that it does not fake data — `PENDING` dashes, `COACH_NOTE` marked as
"authored copy, not a finding". A `Game saved ✓` state with `Filed under Your games on the You tab`
that files nothing would break that rule.

#### Decision 2 — how far does "Settle" go? · **RESOLVED 2026-09-08: gate only, no save**

Ship §4 minus the save. `Settle the table →` reveals the panel; the units-led column, the row
grounds and the balanced test (`sum(endPoints) === pointsPerStack * players`) are all real; the
button reaches **Disabled** and **Enabled** but not **Saved**, and its helper copy does not promise
filing. P19 adds the save and the third state later.

Rejected, and why: a `Game saved ✓` that files nothing would break the rule this repo already keeps
elsewhere — `PENDING` dashes, `COACH_NOTE` labelled "authored copy, not a finding". Better to ship
two honest states than three with one lying.

**Phase 5 must therefore not** write to `games`, touch `src/data/profile.ts`, or render the
`Saved` style. Leave a comment at the Settle button naming P19 so the missing state is deliberate
on the page rather than looking unfinished.

### 3c · Colour semantics move (§4.2)

Balance rows today: winner = `redTintDeep`, loser = `surfaceLocked`. Update 02 **inverts** it —
winner becomes `#0b1210` + a `#c9a75c` hairline (which is exactly this codebase's "good state"
convention), and the red ground `#33201a` moves to **players who lost units**.

That is a new sanctioned use of red. CLAUDE.md currently says *"Red is only for the chip action,
hearts, the 'Playing' badge and chip-tool focus rings."* **Update that sentence in the same commit**,
or the next reviewer reverts it as a violation.

### 3d · Structural notes

- `TabScreen` puts `paddingHorizontal: 18` on the scroll content. Home's new full-bleed horizontal
  scrollers (week cards, tables carousel) need TabScreen to allow edge-to-edge sections — add an
  opt-out rather than duplicating the scroller.
- The Hand of the day scroll reveal is an `IntersectionObserver` in the prototype. RN equivalent:
  `onLayout` for the card's y, plus a listener on `TabScreen`'s existing `scrollY`. Note that
  `scrollY` is fed with `useNativeDriver` on native, so JS needs `scrollY.addListener` — do not
  switch the driver off, that would kill the `BackgroundCards` parallax.
- `anim.tsx`'s `Flip` is a **one-shot entry animation**, not a two-face persistent flip. The streak
  card and Hand of the day both need a real one — build it once as a shared primitive.
- `joker-face.png` must be copied into `assets/` to be bundled. `docs/design-handoff*/` is
  read-only reference and is not a bundler root.

---

## 4 · Phase order

Each phase ends green on both:

```bash
npm run typecheck
```

```bash
npm test
```

| # | Phase | Depends on | Risk | Status |
| --- | --- | --- | --- | --- |
| 1 | Land the package, record the gap | — | none | **done** — `e6d9887`, `2ddedb9` |
| 2 | Spike: 3D rank chip on RN | 1 | **high** | **done** — folded into 3 |
| 3 | Tokens + shared primitives (`FlipCard`, `ranks.ts`, `RankChip`) | 2 | med | **done** — `86dde7a` |
| 4 | Chips — setup (§3) | 1 | low | **done** — `afa12d7` |
| 5 | Chips — Settle + Balance (§4) | 4, Decision 2 | med | **done** — `51bc4cf` |
| 6 | Drill — held cards (§2) | 3 | low | **done** — `0f6a601` |
| 7 | You — stats, rank card, ladder (§5) | 3 | med | **done** — `18884f1` |
| 8 | Home — rewrite + §1 | 7 | **high** | **done** — `07a06c2`, less the side bet |
| 8b | The side bet, for real | 8 | **high** | **open** — needs a rule (below) |
| 9 | Docs reconciliation | 8 | low | **done** |

Phases 7 and 8 were built before 4–6 in the end: the rank chip was the one piece that might not
have been possible on React Native at all, and the You tab is where it lives, so proving it came
first.

### Phase 8b — the side bet

The prototype's card reads *"Win 2 more drills without dropping a heart and today's XP doubles."*
Nothing in the app doubles XP and no run of clean drills is tracked, so the card is not built. The
decision was to build the mechanic for real, which means:

- a **clean** drill is a completed lesson with no wrong answer — `lesson_completions` already
  stores `correct_count` and `question_count`, so this needs no new column
- the **run** is consecutive clean completions, newest backwards, broken by any drill that dropped
  a heart
- the **reward** doubles XP, and XP is derived on every read (`v_correct * 8` in `get_state`), so
  the payout has to be derivable too rather than banked

The open question is the exact rule — what "doubles" attaches to, and whether the run resets after
paying out. Settle that before touching `get_state`: XP feeds the rank ladder and the You tab, and
`supabase/tests/economy.test.sql` pins the current arithmetic.

Why this order:

- **Chips first** (4–5): entirely self-contained, and §3.2 fixes a real bug (the entry-bet field
  cannot currently be emptied). Fastest honest win, zero coupling.
- **You before Home** (7 before 8): §1.4 insists *Home's rank card must never follow the ladder
  selection on the You tab*. Build the ladder and its `viewRank` selection first, then Home's card
  is written as live-only against a selection that already exists — and the isolation is testable
  the day it is written, instead of being a promise.
- **Home last** (8): it is the rewrite, and it is the part with no README. Everything it shares
  (`RankChip`, `FlipCard`, ranks) is already proven by then.

---

## 5 · Prompts

One session per phase. Each is self-contained — paste it into a fresh session in this repo. Every
prompt assumes CLAUDE.md is loaded automatically (it is).

> **Both decisions are resolved** (2026-09-08) and the prompts below inherit them: Home is a **full
> replacement** of the six superseded components, and Settle is **gate only, no save**. Prompt 5's
> "wait for my answer" step is done — go straight to the implementation. Work happens on the
> `design-update-02` branch, not on main.

### Before you start — get the package into the repo

Unzip and copy the bundle in as a **sibling** of the existing handoff, never over it. The filename
`Poker Coach v3 felt.dc.html` collides with package 01's copy, and package 01 is still the spec for
everything update 02 does not mention.

```bash
mkdir -p docs/design-handoff-02 && cp -r "/c/Users/AsusPC/Downloads/design_handoff_poker_coach_update_02/." docs/design-handoff-02/ && cp docs/design-handoff-02/design/joker-face.png assets/joker-face.png
```

(Unzip the download first if you have not — the path above is the extracted folder.)

Then check `.gitignore` does not exclude `docs/` or `*.png`, and commit the bundle on its own so the
handoff lands as one reviewable, unmodified import.

---

#### Prompt 1 — land the package

```
Read docs/design-update-02-plan.md.

Land the update-02 handoff bundle in the repo, on a branch off main:

1. Copy the extracted design_handoff_poker_coach_update_02/ into docs/design-handoff-02/
   as-is. Do not edit anything inside it — it is a delivered bundle, read-only like
   docs/design-handoff/. Keep both prototypes; the filenames collide, so they must not
   share a directory.
2. Copy design/joker-face.png to assets/joker-face.png so the bundler can reach it.
3. Add a short pointer at the top of docs/design-handoff/README.md saying package 01
   still describes the app as a whole, that docs/design-handoff-02/ carries the deltas,
   and that the newer prototype HTML is the authoritative full-state spec.
4. Commit the bundle by itself, then the pointer as a second commit.

Change no app code. Confirm npm run typecheck and npm test still pass.
```

---

#### Prompt 2 — spike the 3D chip

```
Read docs/design-update-02-plan.md §3a, then docs/design-handoff-02/README.md §5.1.

Spike ONLY — I want a decision, not a finished component.

Build a throwaway RN spike of the 3D rank chip and tell me what is actually achievable
on React Native 0.86 / Expo 57, given: no transform-style: preserve-3d, no conic
gradient, built-in Animated only (no reanimated, no gesture-handler), react-native-svg
15.15.4 available, and the CLAUDE.md rule that loops pass
useNativeDriver: Platform.OS !== 'web'.

Answer these, with the spike as evidence:
- Does the two-face flip work with backfaceVisibility + parent perspective/rotateY?
- Can the 24-segment milled rim read as 3D at all, or does it collapse flat? If it
  collapses, does an SVG segmented ring get close enough to the screenshot in
  docs/design-handoff-02/screens/03-you-stats-rank.png?
- What does the drag (PanResponder) + idle spin + 1.6s ease-back-to-rest cost on the JS
  thread with two instances mounted, and can the idle spin be a native-driven
  Animated.loop instead of the specced 55ms interval?

Put the spike under the scratchpad, not in src/. Report a recommendation and the exact
deviations you would record. Do not touch any screen.
```

---

#### Prompt 3 — tokens and shared primitives

```
Read docs/design-update-02-plan.md, then docs/design-handoff-02/README.md
("Tokens introduced or reused" + §5.1).

Add the shared foundation for update 02. No screen changes in this phase — nothing
should look different when you are done.

1. src/theme/tokens.ts — add the values update 02 introduces, using the handoff's own
   names: cover ground #1d4433, the silver hairline gradient
   (115deg #5d6470 → #e6ebf0 36% → #aab3bd 62% → #5a6270), winner row ground #0b1210,
   loser row ground #33201a, mastered bar fill #c9a75c. Reuse what already exists rather
   than adding near-duplicates — check the file first.
2. src/components/FlipCard.tsx — a two-face persistent flip (front/back, backface
   hidden, .55s cubic-bezier(.2,.8,.2,1)), with hit testing gated by flip state so the
   hidden face gets pointerEvents none. anim.tsx's Flip is a one-shot entry animation and
   is not this. Both the Home streak card and Hand of the day will use it.
3. src/data/ranks.ts + ranks.test.ts — the rank ladder, which is a NEW domain concept.
   Values from the prototype's RANKS array in
   docs/design-handoff-02/design/Poker Coach v3 felt.dc.html:
     White chip 0 XP  #f4f1e6 ink #17181a dash #2b2b2b
     Red chip   400   #ff7a63 ink #ffffff dash #ffffff
     Green chip 1000  #4a6b52 ink #ffffff dash #ffffff
     Blue chip  2000  #3a4f6b ink #ffffff dash #ffffff
     Black chip 4000  #1a1a1a ink #ffffff dash #ffffff
   Expose: rank for an XP total, the level index (L1..L5), XP to the next rank, and
   whether a rank is reached. Test the boundaries (0, 399, 400, 4000, above 4000) — this
   is the kind of arithmetic the app must not get wrong quietly.
4. src/components/RankChip.tsx — the shared 3D chip, built to whatever the Phase 2 spike
   concluded. It takes the rank to display as a prop; it must NOT read live XP itself,
   because Home and You bind it to different values.

npm run typecheck and npm test must pass.
```

---

#### Prompt 4 — Chips setup

```
Read docs/design-handoff-02/README.md §3 and the screenshot
docs/design-handoff-02/screens/02-chips-entry-bet.png.

Apply §3 to src/screens/ChipsScreen.tsx.

§3.1 — move "1 unit = 100 pts / Stack <buyIn> pts / Case <availPts>" out of the Entry bet
card into one quiet line below both cards, per the spec's flex/type values. Players and
Entry bet must end up equal height. availPts already carries its own "pts each" suffix —
do not append it twice.

§3.2 — the entry-bet field must be emptiable. Today it coerces to 1 on every keystroke.
While typing it holds raw text (digits only, may be empty); on blur an empty field falls
back to 1 unit (buyIn = 100); any non-empty value clamps to >= 1 unit and clears the
solved result.

Do not touch the Balance panel — that is the next phase. npm run typecheck and npm test
must pass.
```

---

#### Prompt 5 — Chips Settle + Balance

```
Read docs/design-handoff-02/README.md §4, and docs/design-update-02-plan.md §3b and §3c.

DECISION NEEDED BEFORE YOU START: §4.3 says settling "saves the game to Your games and
increments the games counter", but GAMES in src/data/profile.ts is sample data and the
games counter is server-side and stays 0 until P19 in docs/accounts-plan.md. Read §3b of
the plan, tell me which of the three options you recommend, and wait for my answer.

Then implement §4 in src/screens/ChipsScreen.tsx and src/screens/chips/BalanceCard.tsx:

- §4 gate: after a successful deal, show only a "Settle the table →" pill (full width,
  54px, 1.5px #c9a75c border, transparent, #e8cf8a ink). Tapping it opens the Balance
  panel. The panel closes and resets whenever a new deal is solved or a saved game is
  loaded.
- §4.1: the right-hand column becomes units-led — header "Units", big signed figure to 2
  decimals with no suffix, "<points> pts" small underneath. Positive #e8cf8a, negative
  #adc2b6, level #6d887a. Reuse signedUnits/signedPoints from src/lib/balance.ts; do not
  reimplement the rounding.
- §4.2: winner rows get ground #0b1210 + 1px #c9a75c; losers get #33201a with no border;
  even rows #16261e. This INVERTS today's colours — red now marks players who lost units.
  Update the colour-semantics sentence in CLAUDE.md in the same commit.
- §4.3: the Settle button's three states and helper lines exactly as tabulated. Balanced
  test is sum(endPoints) === pointsPerStack * players. Editing any seat total after
  saving returns the button to its unsaved state.

npm run typecheck and npm test must pass — src/lib/balance.test.ts especially.
```

---

#### Prompt 6 — Drill held cards

```
Read docs/design-handoff-02/README.md §2, the screenshot
docs/design-handoff-02/screens/01-drill-held-cards.png, and
docs/design-update-02-plan.md §2.

Apply §2 to src/screens/DrillOverlay.tsx.

Derive, do not migrate. Question.cards already encodes hole cards as the leading
offset:0 entries — src/content/types.ts says so and course.test.ts already enforces it.
So hole = cards.filter(c => (c.offset ?? 0) === 0) when there are exactly two, and the
board is the rest. Do NOT restructure course.ts and do NOT run npm run sync:content:
cardsLabel is not part of the content hash (see src/content/manifest.ts —
manifestSource hashes only ids, the correct option and the option ids).

- Render the two hole cards as the fanned hand above the answer options, with the
  geometry, deal-in animation (holeup, then holeleft/holeright at .48s) and tap-to-open
  second state from §2.1/§2.2. Suit pips go through <Suit> per CLAUDE.md — Archivo has no
  card glyphs.
- The board stays in the top row. Re-caption: the ~50 labels reading
  "The board — you hold A♠ K♥" lose the "you hold" half (the hand now shows it), and
  "Your two cards, then the flop" becomes "The flop".
- EDGE CASE, not covered by the handoff: 32 questions caption "Your two cards" and have
  NO board cards. Proposal — render no top row and no caption for those; the hand alone
  carries it. Leave their cardsLabel strings in the data so course.test.ts's "captions
  every fan" keeps passing. Flag it to me if you disagree.

npm run typecheck and npm test must pass, content-hash.json unchanged.
```

---

#### Prompt 7 — You screen

```
Read docs/design-handoff-02/README.md §5 and the screenshot
docs/design-handoff-02/screens/03-you-stats-rank.png.

Apply §5 to src/screens/YouScreen.tsx, using src/data/ranks.ts and RankChip from Phase 3.

- §5.4 stats grid: the four separate colored cards become ONE #16261e card, radius 24,
  2×2 grid divided by 1px rgba(240,239,233,.08) hairlines on the inner edges only. Each
  cell: 6px status dot + label, 27px value, note underneath. Total XP (dot #57b183, note
  = rank name) · Day streak (#e8cf8a, note "Best <n>") · Accuracy (#7fd6a5, "Last 50
  drills") · Games set up (#8ea79a, "All time"). Keep the PENDING dash behaviour for
  anything not yet hydrated — do not invent values.
- §5.1/§5.2: the rank card with the 3D chip, and the ladder row showing cleared ranks,
  the current rank, and the next one only (ranks.slice(0, currentIndex + 2)) with the
  next rendered disabled. Tapping a cleared or current chip retargets THIS card only:
  chip takes that rank's colours and level, bar fills 100% in gold #c9a75c, note becomes
  "Mastered · tap your current chip to go back". Tapping the current chip returns to live
  XP. The chip label must reflect the SELECTED rank, not the live level.
- §5.3: the "Show ladder" / "Hide ladder" text button and the full-ladder card.

The viewRank selection is local to this screen. Home's rank card must never see it — §1.4
is explicit, and Phase 8 will rely on that.

npm run typecheck and npm test must pass.
```

---

#### Prompt 8 — Home

```
Read docs/design-update-02-plan.md §1 (the missing middle) first — this phase is a
rewrite of src/screens/HomeScreen.tsx, not a patch, and most of it is documented only as
inline CSS in docs/design-handoff-02/design/Poker Coach v3 felt.dc.html. Read that file's
home tab section and its WEEK/state constants alongside
docs/design-handoff-02/README.md §1.

Everything on Home must come from the store as it does today — streak, XP, accuracy,
week, lessonsToday, completedLessons, progress. Do not introduce sample data; use PENDING
for anything unhydrated, per the existing screen.

Build:
- "Your run" header, "<streak> days at the table", streak line.
- The week as seven playing cards, one per day, from the same week data the current bar
  chart uses (src/lib/week.ts). Days played read face-up.
- The streak card, using FlipCard: front face with the chip row, headline, cream CTA and
  §1.2's decorative spade (♠, 232px, rgba(232,207,160,.16), right:-14, vertically
  centred, behind the content, front face ONLY); back face "How the streak works" with
  the three numbered points. §1.3: the front face sits in normal flow so the card sizes
  to its content and the back face is the absolute one — the old fixed 258px box left a
  ~40px dead strip. Two-dot toggle beneath.
- §1.5 Hand of the day: two-sided, cover showing at rest, swipe left/right >40px to flip
  (tap must NOT flip — it has to reach the answer options), pointerEvents gated by flip
  state or the cover swallows taps. Scroll reveal fires once at ~30% into the viewport;
  see docs/design-update-02-plan.md §3d for the RN equivalent of the IntersectionObserver
  and the warning about TabScreen's native-driven scrollY. Cover face per spec, using
  assets/joker-face.png.
- §1.4 the rank card, RankChip pinned to the LIVE rank. It must not react to the You
  tab's ladder selection — separate binding, and say so in a comment.
- "Pick a table" + See all + the tables carousel, driven by real chapter progress
  (src/content/progress.ts), same as the Path.
- The side bet card and the "Playing tonight?" strip.

TabScreen pads its content 18px horizontally; the week cards and the tables carousel are
full-bleed. Add an opt-out to TabScreen rather than duplicating the scroller.

Copy that is not in the prototype is ours to write — keep it in the house voice and flag
anything you invented. npm run typecheck and npm test must pass.
```

---

#### Prompt 9 — docs reconciliation

```
Update 02 is implemented. Reconcile the docs, changing no behaviour.

- README.md "Deviations from the handoff": add what update 02 forced — at minimum the 3D
  rank chip's RN fallback (whatever Phase 2 concluded), and anything else where the
  prototype's CSS had no RN equivalent. Remove any deviation that update 02 made moot.
- CLAUDE.md: confirm the colour-semantics sentence now covers red on losing Balance rows
  (Phase 5 should have done it). Add a line about docs/design-handoff-02/ being the delta
  bundle and the newer prototype being the authoritative full-state spec.
- docs/authoring-lessons.md: if the hole/board split changed anything an author needs to
  know about cardsLabel, say so. If it did not, leave it alone.
- docs/design-update-02-plan.md: mark the phases done and record the two decisions and
  how they were resolved.

npm run typecheck and npm test must pass.
```

---

## 6 · Regression watchlist

Things that will break quietly if a phase gets careless:

- `content-hash.json` / `npm run sync:content` — must **not** move for anything in this update.
  If a session proposes re-syncing, it has changed something it should not have (an option id, a
  correct answer, a question count).
- `course.test.ts` — *captions every fan* still requires a non-empty `cardsLabel` wherever `cards`
  exists, even where Phase 6 stops rendering the top row.
- `BackgroundCards` parallax — driven by `TabScreen`'s native `scrollY`. Adding a JS listener for
  the Hand of the day reveal is fine; switching the driver off is not.
- `balance.test.ts` — §4.1 reorders the Balance column but must not change the arithmetic.
- The `Lesson` union — anything switching on `lesson.kind` stays total over `drill` and `table`.
- Home's rank card vs the You ladder (§1.4) — the one cross-screen invariant in the update.
