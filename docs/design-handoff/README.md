# Handoff: Poker Coach — lessons + chip counter (MVP)

## Overview

A mobile poker **utility** — not a game. Two pillars:

1. **Basic lessons**, Duolingo-style: a unit path, short drills with multiple-choice answers, streak, XP, hearts.
2. **Chip counter**: a *setup* tool for a real, physical home game. The user enters the chips they physically own (colour, quantity, value), the number of players and the entry bet in units. The app assigns an equal stack per player, picking denominations, and then converts end-of-game point counts back into units (the **Balance** section).

There is **no live game tracking and no real money**. Stakes are abstract "units"; 1 unit = 100 points, always.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy. `Poker Coach v3 felt.dc.html` is a single-file prototype: an HTML template plus a JavaScript logic class, rendered by an in-house runtime (`support.js`). Do **not** port that runtime.

The task is to **recreate these designs in the target codebase's existing environment** (React Native, SwiftUI, Flutter, React web, etc.) using its established patterns, component library and navigation. If no environment exists yet, pick the framework that fits the product (a phone-first app — React Native or SwiftUI are the natural choices) and implement there.

The prototype's algorithms (chip-fitting solver, Balance maths, initials logic) are the parts worth porting closely — they are documented below and are plain JavaScript in the file, near the bottom under `<script type="text/x-dc">`.

## Fidelity

**High fidelity.** Final colours, typography, spacing, radii, animation timings and copy. Recreate pixel-close, substituting the codebase's own primitives where they exist. Layout was authored at 390 × 844 (iPhone 14-class); it is a single-column phone layout that should adapt fluidly to other phone widths and to tablets by capping content width (~480px) and centring.

Two earlier versions are included for context only — do **not** implement them:

- `Poker Coach.dc.html` — v1, flat light "Modernist" version (no rounded corners).
- `Poker Coach v2.dc.html` — v2, light playful version.
- **`Poker Coach v3 felt.dc.html` — v3, the current design. Implement this one.**

---

## Design tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| Ground / page behind the phone | `#080d0a` | app background base |
| Felt gradient | `radial-gradient(130% 85% at 50% -5%, #1d4433 0%, #12271d 45%, #0b1610 100%)` | screen background |
| Felt weave overlay | `repeating-linear-gradient(0deg, rgba(240,239,233,.022) 0 1px, transparent 1px 3px)`, `repeating-linear-gradient(90deg, rgba(0,0,0,.055) 0 1px, transparent 1px 3px)` | layered above the gradient |
| Surface (cards) | `#16261e` | list rows, cards |
| Surface deep | `#0f1c15` | nested card (Your games) |
| Surface input | `#1e3228` | inputs, pills, track fills |
| Surface input alt | `#12201a` | focused input background |
| Track | `#22362b` | progress bar track |
| Hairline | `rgba(240,239,233,.10–.22)` | 1px separators, outline buttons |
| Text primary | `#f0efe9` | body text on felt |
| Text on reward | `#ffffff` | text inside reward surfaces |
| Text secondary | `#adc2b6` | supporting copy |
| Text muted | `#8ea79a` | labels, kickers |
| Text faint | `#6d887a` | hints |
| Card face (playing cards, light chips) | `#f4f1e6` | face-up card tiles |
| Card face ink | `#17181a` | spades/clubs pips, dark text on light |
| Card face red | `#b5121f` | hearts/diamonds pips |
| Accent red (primary action) | `#ff563c` | "Deal the stacks", hearts, focus rings |
| Accent red hover | `#ff7a63` | |
| Accent red soft text | `#ff9783` | |
| Accent red tint | `#4d2318` / `#33201a` | red-tinted fills |
| Reward green | `#57b183` | progress fills, "good" marks |
| Reward green light | `#7fd6a5` | positive figures, hover ink |
| Reward surface | `#08110d` / `#0b1210` | near-black background of reward elements |
| Gold ink | `#e8cf8a` | reward text, index letters, court-card strokes |
| Gold rule | `#c9a75c` | 1px borders, focus on login/name fields |
| Gold gradient (1px border texture) | `linear-gradient(115deg,#8a6a2f 0%,#f0dca0 36%,#c8a558 62%,#7d5f2a 100%)` | see "Gold hairline" below |
| Chip default swatches | White `#f4f1e6`, Red `#ff7a63`, Green `#4a6b52`, Blue `#3a4f6b`, Black `#1a1a1a` | |
| Chip extra swatches (added chips, in order) | Purple `#6b4a7a`, Orange `#d97b2b`, Grey `#8a8a8a`, Pink `#c9628a`, Teal `#2f7d7a`, Yellow `#d8b23a` | |

**Gold hairline** — the "pro detail" on reward surfaces. A 1px border filled with the gold gradient, done with a double background:

```css
background-image: linear-gradient(#0b1210, #0b1210), /* the surface fill */
                  linear-gradient(115deg,#8a6a2f 0%,#f0dca0 36%,#c8a558 62%,#7d5f2a 100%);
background-origin: border-box;
background-clip: padding-box, border-box;
border: 1px solid transparent;
```

On platforms without `background-clip` tricks, use a 1px gradient-stroke border (e.g. `LinearGradient` wrapper with 1px padding around the dark surface).

### Colour semantics (important)

- **Red** is reserved for the one primary chip action ("Deal the stacks"), hearts/lives, the "Playing" badge on the current unit, and input focus rings in the chip tool.
- **Reward / "good"** states are **not** green backgrounds. They are near-black (`#08110d`–`#0b1210`) + **white** text + a **1px gold** hairline, with gold accents. This applies to: the drill CTA ("Deal me in"), "Back to today", the correct answer option, the correct-answer feedback card, the header streak pill, the day-streak stat.
- **Green** appears as *surface* (felt, table-green cards) and as thin **progress fills** (`#57b183`) only.

### Typography

Single family: **Archivo** (Google Fonts; weights 400 and 800 only). Loaded through the Modernist design-system stylesheet in the prototype — in the target codebase use the codebase's Archivo or add it.

| Role | Spec |
| --- | --- |
| Screen title (h2) | 800, 27px / 1.03, letter-spacing −.025em |
| Hero title | 800, 30px / 1.03, letter-spacing −.025em |
| Result headline (h3) | 800, 24px / 1.05, −.02em |
| Section heading (h3) | 800, 22px / 1.05, −.02em |
| Big number (XP screen) | 800, 46px / .98, −.035em |
| Stat number | 800, 24px / 1 |
| Row title | 800, 17px / 1.15 (units), 800 13–14px / 1.15 (list rows) |
| Body | 400, 12–14px / 1.4–1.5 |
| Kicker / label | 400, 10px / 1, letter-spacing .10–.14em, uppercase |
| Micro label | 400, 8–9px / 1, .06–.10em, uppercase |
| Button label | 800, 15px / 1 (primary), 800 10–12px / 1 uppercase (secondary/tab) |

### Spacing, radius, elevation

- Screen padding: `66px 18px 26px` (the 66px top clears the translucent header).
- Card padding: 16–20px. Row padding: 8–14px. Gaps: 7–10px in lists, 10–14px in grids.
- Radius: 38px phone frame · 28px hero and result cards · 26px nested cards · 22px small cards · 20px rows · 18px balance rows · 16px inputs (login) · 12–14px small inputs · 999px pills and buttons · 50% chips and circular buttons · 8px card-tile corners.
- Shadows: rows `0 1px 2px rgba(0,0,0,.45)`; chips `0 1px 3px rgba(0,0,0,.55)`; big cards `0 16px 30px rgba(0,0,0,.20–.40)`; phone frame `0 12px 32px rgba(45,43,43,.22)`.
- Minimum touch target: 44px (all buttons and inputs honour this).

### Motion

| Name | Spec | Where |
| --- | --- | --- |
| `rise` | 300–450ms ease, `translateY(14px)` + fade in | screens, cards, feedback, login |
| `pop` | 350ms ease, `scale(.92 → 1.02 → 1)` + fade | correct answer, result card, XP screen |
| `shake` | 400ms ease, ±7px horizontal | wrong answer |
| `chipdrop` | 300–400ms ease, `translateY(-18px) rotate(-12deg)` → 0 | chip rows, card fan |
| `flipa` / `flipb` | 500ms cubic-bezier(.2,.8,.2,1), `rotateY(∓84° → 0)`, perspective 800px | drill question changes; alternates by question index parity |
| `tilt3d` | 8s ease-in-out infinite, perspective 900px, `rotateX ±2°`, `rotateY ±2.4°`, `translate3d(±5px, ∓4px, 0)` | hero card and result card (result card runs `reverse`) |
| `sheen` | 8s ease-in-out infinite, radial white glow translating (−16%,18%) → (16%,−18%), opacity .10 → .26 | overlay inside hero and result cards |
| `glow` | 2.6s ease-in-out infinite, `box-shadow 0 0 0 0 → 0 9px rgba(232,207,160,.30) → 0` | drill CTA |
| Progress bars | `width` transition 600ms cubic-bezier(.2,.8,.2,1) | daily goal, unit bars |
| Buttons | `transform` 120ms ease; active `scale(.98–.99)` | primary buttons |

---

## Screens / Views

Navigation: a persistent 4-tab bar (Home · Path · Chips · You). Two full-screen overlays: **Login** (z 30) and **Drill** (z 20). The header (z 6) and background (z 0) sit under the content layer (z 1).

### 0. Login (overlay, shown until authenticated)

- **Purpose**: enter the app. Simple email/password plus Google.
- **Layout**: full-screen, opaque felt background (gradient + weave, no transparency — the app must not read through), `overflow: hidden`, content vertically centred, padding 28px 22px.
- **Decoration**: two gold-stroke court cards, `position: absolute`, `pointer-events: none` — A♠ top-right (width 200, rotate 13°, opacity .22) and K♠ bottom-left (width 190, rotate −11°, opacity .14).
- **Components**
  - Brand row: 30px rounded-square (radius 10, `#1d4433`) with ♠ in `#f0efe9`, then "Poker Coach" 800/14.
  - `h2` "Take a seat" — 800/30, white. Sub: "Your streak, your units, your chip case — all waiting." 400/13, `#8ea79a`.
  - Email input — placeholder `you@table.com`, 50px min-height, radius 16, bg `#12201a`, 1px `rgba(240,239,233,.14)`, focus border `#c9a75c`, caret `#e8cf8a`.
  - Password input — same, `type="password"`, placeholder "Password".
  - **Log in** — full width, 54px, pill, reward style (near-black + 1px gold hairline + white label), trailing 36px circle `rgba(255,255,255,.1)` containing ♠ in gold. Hover lightens fill to `#141c19`; active `scale(.99)`.
  - Divider: 1px hairline · "or" (400/9, .14em, uppercase, `#6d887a`) · 1px hairline. Margin 20px 0.
  - **Continue with Google** — full width, 52px, pill, `#f4f1e6` background, `#17181a` label 800/14, hover `#ffffff`; leading 17px Google "G" mark (4-colour SVG). Centred content, gap 11px.
  - Footer row, space-between: "Create an account" (400/11, `#8ea79a`, underlined, 3px offset) and "Forgot password?" (400/11, `#6d887a`). Hover both `#e8cf8a`.
- **Behaviour**: any of the four buttons authenticates (prototype stub) and dismisses the overlay. Real implementation: wire email/password and Google OAuth; keep the prototype's layout.

### 1. Header (persistent, above all tab content)

- `position: absolute; top/left/right: 0; z-index: 6`. Padding `16px 18px 12px`.
- Translucent: `background: rgba(10,20,15,.58)`, `backdrop-filter: blur(12px) saturate(1.15)`, bottom hairline `rgba(240,239,233,.07)`. Content scrolls behind it.
- Left: 30px ♠ mark + "Poker Coach" 800/14.
- Right: **streak pill** — reward style (near-black fill, 1px gold hairline, radius 999, padding 6px 11px): streak number 800/12 in `#e8cf8a`, then "day" 400/10 uppercase in `rgba(255,255,255,.7)`. Then **hearts pill** — `#1e3228`, radius 999, padding 6px 9px, five ♥ glyphs 800/11: filled `#ff563c`, spent `#2c4238`.

### 2. Background (persistent, per tab)

Two gold court cards drawn as inline SVG (viewBox 120×170, `fill: none`, `stroke: #e8cf8a`, `stroke-width: 1.1`, non-scaling stroke), inside a `position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0` layer:

- Card A: `top: 120px; left: −40px; width: 230px; opacity: .34; transform: rotate(−9deg) translateY(parallax₁)`.
- Card B: `top: 560px; right: −56px; width: 190px; opacity: .16; transform: rotate(13deg) translateY(parallax₃)`.
- Card art: outer rounded rect (`x2 y2 w116 h166 rx9`), inner frame (`x26 y14 w68 h142`), corner index letter (18px, 800) + ♠ (15px), and a mirrored court figure inside (crown zigzag, band, head circle, brow line, collar curve, shoulder path, waist diamond, centre rule, then the same rotated 180° about the card centre). For the Ace, the figure is replaced by a single 72px ♠ pip centred.
- **Rank per tab**: Home K♠/Q♠ · Path Q♠/J♠ · Chips J♠/K♠ · You A♠ (ace pip) /Q♠.
- **Parallax**: on scroll, translateY = `−scrollTop × 0.12` (card A) and `−scrollTop × 0.42` (card B). A third factor `0.26` exists for future layers. Scroll position resets to 0 on tab change.

### 3. Home

- **Purpose**: today's goal, one tap into a drill, quick glance at form.
- **Hero card** — radius 28, padding `22px 20px 20px`, near-black gradient fill `linear-gradient(155deg,#151a18,#0d1211 60%,#080c0a)` + 1px gold hairline, white text, `overflow: hidden`, `tilt3d` + `sheen`, drop shadow `0 16px 30px rgba(0,0,0,.20)`.
  - Kicker "Today's hand" (400/10, .14em, `rgba(255,255,255,.6)`).
  - Title "Three more drills and the streak is yours" — 800/30, max-width 16ch.
  - Progress: 12px track `rgba(255,255,255,.14)` radius 999, fill `#57b183` at 40%.
  - Footer row: "2 of 5 drills" · "1,240 XP" (400/11, `rgba(240,239,233,.65)`).
  - Decorative ♠ 150px at `right: −14px; bottom: −46px`, `rgba(240,239,233,.08)`.
- **Drill CTA** — full width, 58px, pill, reward style + `glow`, label "Deal me in — Position" 800/15 white, trailing 38px circle with ♠.
- **Two quick cards** (grid 1fr 1fr, gap 10): "Unit 2 · Position / 3 of 6 lessons" on `#16261e`; "Chips for tonight / {players} players · {units} units in" on `#33201a` with a red ♦. Radius 22, padding 14, suit glyph 800/22, title 800/13, sub 400/11 `#8ea79a`.
- **Stat pills** — wrapping flex, gap 8: `78% Sharp`, `42 Drills`, `7 Streak`, `L4 Level`. `#1e3228`, radius 999, padding 9px 14px, number 800/15, label 400/10 uppercase.
- **Coach note card** — `#33201a`, 2px border `#7a3324`, radius 24, padding 16px 18px. Title "You fold too much from the button." 800/15. Body "Last seat to act, best seat at the table. Tomorrow's drill is all yours." 400/12 `#ffc4b8`.
- **Week chart card** — `#16261e`, radius 24, padding 16px 18px. Label "This week". Seven bars, height 74px container, `align-items: flex-end`, gap 7, each bar radius 8: M 46px, T 62px, W 30px, T 70px, F 54px (all `#f0efe9`), S 18px (`#2c4238`), S 26px (`#ff563c`). Day letter 400/9 under each.

### 4. Path

- **Purpose**: see the course, tap into the current unit.
- Title "Hold'em, one habit at a time" + sub "Five drills a day. No lectures."
- **Unit rows** (5), radius 26, padding 16, margin-bottom 10, `transform: translateY(−2px)` on hover:
  - **Card tile** instead of an icon: 42 × 58, radius 8, shadow `0 3px 8px rgba(0,0,0,.45)`, suit glyph 800/19 centred.
    - Mastered / current → face-up: `#f4f1e6` face, 1.5px `rgba(0,0,0,.35)` border, pip ink `#17181a` (♠♣) or `#b5121f` (♥♦).
    - Locked → card back: `repeating-linear-gradient(45deg,#2e6b4f 0 5px,#1d4433 5px 10px)`, border `rgba(240,239,233,.25)`, glyph `rgba(240,239,233,.55)`.
  - **Dealer button** on the current unit: 24px circle `#f4f1e6`, ink `#17181a`, "D" 800/10, at `right: −9px; bottom: −7px`, shadow `0 2px 5px rgba(0,0,0,.5)`.
  - Title 800/17, status badge (radius 999, padding 4px 9px, 800/9 uppercase): Mastered (`#2e6b4f` on ink) · Playing (`#ff563c`, cream ink) · Up next / Locked (`#22362b`, `#8ea79a`).
  - Sub 400/12 `#8ea79a`; 8px progress bar, track `#22362b`, fill `#57b183`.
  - Row background: current `#33201a`, locked `#15231c` (no shadow, muted title `#6d887a`), else `#16261e`.
  - Units: 1 Hand ranks ♠ (done, 100%) · 2 Position ♥ (current, 50%) · 3 Pot odds ♦ (up next, 0%) · 4 Bet sizing ♣ (locked) · 5 Reading the table ♠ (locked). Locked rows are inert.

### 5. Drill (overlay over the whole app, z 20)

- Opaque felt background; `rise` in.
- **Top row**: 40px circular close button (`#1e3228`, ✕ icon) · progress segments (one per question, 9px tall, radius 999: past `#f0efe9`, current `#ff563c`, future `#22362b`, 300ms transition) · hearts pill.
- **Question body** (`flipa`/`flipb` per question):
  - Kicker chip: inline pill `#1e3228`, padding 6px 12px, 800/9 uppercase — "Unit 2 · Position · 1 of 3".
  - Prompt 800/23 / 1.12, −.02em.
  - Optional card fan: 52 × 72 cards, radius 12, `#f4f1e6`, shadow `0 2px 6px rgba(0,0,0,.18)`, rank top-left 800/17, suit bottom-right 16px, ink `#17181a` (♠♣) / `#b5121f` (♥♦), `margin-top` offset 0 or 10px to fan hole-cards vs board, `chipdrop` in. Caption 400/10 uppercase.
  - Context line 400/13 `#adc2b6`.
- **Answers** (pinned to the bottom, gap 9): full-width buttons, 56px, radius 20, 1px border, 800/14, trailing mark glyph.
  - Unanswered: `#16261e`, transparent border, `#f0efe9`.
  - Correct: `#08110d` fill, **1px `#c9a75c`** border, **white** label, gold ♠ mark, `pop`.
  - Picked wrong: `#1e3228`, `#f0efe9` border, red ♥ mark, `shake`.
  - Other options once answered: `#13211a`, muted `#6d887a`.
- **Feedback card** (after answering): radius 24, padding 16px 18px, `rise`. Correct → `#08110d` + 1px `#c9a75c`, glyph ♠ and title "Nice hand" in `#e8cf8a`, body white. Wrong → `#1e3228`, no border, glyph ♥, title "Not quite — look again" in `#f0efe9`, body `#f0efe9`.
- **Next button**: `#201e1d`-class dark pill (`#0d1211`), 56px, label "Next one" / "Finish the hand", trailing ♣ circle.
- **Completion screen**: ♠ 800/64 in `#57b183`; kicker "Hand played"; "+{gained} XP" 800/46; note — all three correct: "Clean sweep. One more session and Position is yours." else "Two from three. The one you missed comes back tomorrow."; **Back to today** button in reward style with trailing ♥.
- **Question content** (verbatim, 3 questions, 8 XP each):
  1. "You're first to act before the flop. Where are you sitting?" · context "Six-handed. You're one seat left of the big blind." · options: Under the gun (**correct**) / The cutoff / The button · why: "Under the gun, with five players still to act behind you. Worst seat in the house — open tight and don't be a hero."
  2. "How good is this, really?" · cards A♠ K♠ | Q♦ J♦ 4♠ · caption "Your two cards, then the board" · context "You hold A♠ K♠. The board came Q♦ J♦ 4♠." · options: A made straight / Two overcards and a flush draw (**correct**) / Nothing — give it up · why: "No pair yet, but two live overcards and four spades to come. That's a hand you keep betting, not one you check down."
  3. "Pot's 40. They bet 20. What's it going to be?" · context "You pay 20 to win 60 — that's 3-to-1, so you need to win about one time in four." · options: Fold, you missed / Call, the price is right (**correct**) / Raise to 90 · why: "Your draw lands about a third of the time and the pot only asks for a quarter. Easy call — save the raise for when it hits."

### 6. Chips (the chip counter)

- Title "What's in the case?" · sub "Count your real chips. We'll deal fair stacks and pick the denominations."
- **Two setting cards** (flex, gap 10), each `#16261e`, radius 22, padding 12px 14px:
  - **Players**: label, then − button (44px circle `#1e3228`) · count 800/26 · + button (44px circle `#1d4433`, hover `#2a5f47`). Range 2–10.
  - **Entry bet**: numeric input (78px, 44px tall, radius 14, `#1e3228`) + "units" label. Hint below, 400/10: "1 unit = 100 points" and, in `#8ea79a`, "Stack: {points} pts · case holds {available} pts each".
- **Case header row**: label "The chip case" + segmented pill (`#1e3228`, radius 999, padding 3): **Auto values** / **My values**, active segment `#2e6b4f` with `#f0efe9` ink, inactive `#8ea79a`.
- **Chip rows** (one per colour, `chipdrop` in): `#16261e`, radius 22, padding 11px 12px, gap 10:
  - 36px circular colour well (`border: 2px dashed rgba(240,239,233,.35)`) wrapping a hidden `input[type=color]`.
  - Name text input (flex, 800/14, transparent until hover/focus; 14-char cap).
  - Qty input (52px, centred, `#1e3228`) with micro caption "qty"; 0–500.
  - Value input (56px) with caption "value"; **disabled in Auto mode** (fill `#152219`, ink `#6d887a`); 1–10000.
  - Remove button (30px circle, ×, hover `#4d2318` / `#ff9783`). Minimum 2 colours.
- **Add / total row**: "+ Add chip colour" (dashed 2px pill, 44px min-height, hover border `#ff563c`) and "{total} chips / in the case" right-aligned. Maximum 8 colours.
- **Deal the stacks** — full width, 58px, pill, `#ff563c` fill, label + ♦ in **`#f7e9e4`** (softened white), trailing circle `rgba(255,255,255,.15)`, hover `#ff7a63`, active `scale(.98)`.
- **Result card** ("Every player gets" / "Closest we can get") — radius 28, near-black gradient + gold hairline, white text, `pop` in, `tilt3d` reversed + `sheen`, `overflow: hidden`.
  - Kicker, then headline "{n} chips, worth {points} points" (or "Only {points} points fits").
  - One row per denomination (`chipdrop`): **chip graphic** 32px (see below) with its value on the face · name 400/13 `rgba(240,239,233,.85)` · "×{qty}" 800/15 · row total 400/12 right-aligned 56px.
  - Hairline, then three pills (`rgba(255,255,255,.12)`, radius 999): "{stack} per player", "{dealt} dealt", "{left} in bank".
  - Note: exact fit → "Smallest chip is worth {v} — small enough for blinds, few enough to stack by eye."; smallest chip > 5% of the stack → "Careful: your smallest chip is worth {v}, a big bite out of a {stack}-point stack. Add a smaller chip for room to bet."; no fit → "Add more low chips, drop the entry stack, or seat fewer players." (Auto) / "Your values can't make {stack} exactly. Try Auto values, or add a smaller chip." (Manual).
  - Blind line: "Blinds: {v} / {v×2}, up every 20 minutes", or "too coarse to suggest — add a smaller chip".

- **Chip graphic** (used in the result card and the Balance stacks — this is the canonical chip):
  - Outer disc: circle, background `repeating-conic-gradient(from 0deg, {dash} 0 8deg, {swatch} 8deg 30deg)` where `{dash}` is `#ffffff` on dark swatches and `#2b2b2b` when the swatch's relative luminance (`0.299R + 0.587G + 0.114B`, normalised 0–1) exceeds **0.62**. Shadow `0 2px 4px rgba(0,0,0,.55)`.
  - Inner face: `inset: 4px`, circle, `{swatch}` fill, 1px `rgba(255,255,255,.4)` ring.
  - Value on the face: 800/9–10, **white** with `text-shadow 0 1px 2px rgba(0,0,0,.75)`; on light swatches (luminance > 0.62) it flips to `#17181a` with no shadow.

### 7. Balance (inside the Chips screen, below the result)

- **Purpose**: turn end-of-game chip counts back into units.
- Card `#16261e`, radius 28, padding 20px 18px, `rise`.
- Header: ♣ in `#ff563c` + label "Balance"; `h3` "What a point is worth"; intro "{players} players got {dealt} points each against a {entry}-point entry ({units} units). Count the chips at the end and every point converts back at the rate below."
- **Chip-stack graphic**: wrapping flex row (`gap: 16px 14px`, `align-items: flex-end`), one column per dealt denomination — **all of them, no cap**. Each column: the 30px chip graphic (value on the face), then up to 4 "edge slices" below it (26 × 5, radius 50%, `{swatch}` fill, `inset 0 −1.5px 0 rgba(0,0,0,.4)`), gap 2px; then "×{qty}" 800/10 `#adc2b6` and "{value} pts" 400/9 `#8ea79a`, gap 7px clear of the chips.
- **Rate pills**: "1 point = {scale} of entry" (dark pill `#1d4433`) and "1 unit = 100 points, always" (`#1e3228`). The unit rate is fixed, not editable.
- **Table header** (400/9, .10em, uppercase, `#6d887a`): `Seat` (58px) · `End pts` (62px, centred) · `Counts as` (flex, right) · `Balance` (70px, right).
- **Seat rows**, radius 18, padding 8px 10px, gap 10; background: winning `#33201a`, losing `#15231c`, flat `#16261e`:
  - **Name input** — 58px wide, 38px tall, radius 12, transparent (hover `#1e3228`, focus 1px `#c9a75c` on `#12201a`), 800/13, caret `#e8cf8a`, placeholder "P1"…"P6", `text-overflow: ellipsis`, `white-space: nowrap`. Stores up to 24 characters.
    - **Initials rule**: while the field has focus it shows the full name; on blur, a name longer than **7 characters** collapses to initials — first letter of each of up to 3 words, uppercased ("Marta Rodriguez" → "MR"); a single long word takes its first two letters ("Bartholomew" → "BA"). Full name stays in the `title`/tooltip. The row therefore never wraps or grows.
  - **End pts input** — 62px, 38px tall, radius 12, `#1e3228`, centred 800/14, focus `#ff563c`. Seeded with the dealt stack so everyone starts level.
  - **Counts as** — 400/12 `#8ea79a`, "{value} pts".
  - **Balance** — 800/14: positive `#ff9783`, negative `#adc2b6`, zero `#6d887a`; signed points with "−" (U+2212), and under it 400/10 `#8ea79a` "{±x.xx} units".
- **Tally line** (top hairline, 400/12): all chips accounted for → "Every chip accounted for." (`#8ea79a`); otherwise "{n} points over the {dealt} dealt — recount before paying out." or "Missing {n} points against the {dealt} dealt — recount before paying out." (`#ff9783`). Right side: "{units} units in play".

### 8. You (profile)

- Profile card `#16261e`, radius 28, padding 20: 60px circle `#1d4433` with initials "MR" 800/22; name "Marta R." 800/23; "Level 4 · Friday-night regular" 400/12 `#8ea79a`.
- Stat grid (1fr 1fr, gap 10), radius 22, padding 14px 16px: "1,240 Total XP" (`#1d4433` fill, `#f0efe9`), "7 Day streak" (reward: `#0b1210` fill, `#e8cf8a`), "78% Accuracy", "11 Games set up" (both `#16261e`).
- **Mastery**: label, then four rows — name 800/12 + percentage `#8ea79a`, 9px track `#22362b`, fill `#57b183`. Hand ranks 100% · Position 50% · Pot odds 15% · Bet sizing 0%.
- **Your games** — outline pill button, full width, 52px, label "Your games" + trailing ♠; **collapsed by default**. Open state: border and ink turn gold (`#c9a75c` / `#e8cf8a`) and the glyph becomes ×.
  - Opened panel: `#0f1c15`, radius 26, 1px `rgba(240,239,233,.10)`, padding 16px 14px, `rise`. Header row: "Last 3 of 11" (400/10 uppercase) and "Balance in units" (`#6d887a`).
  - Game rows (`#16261e`, radius 20, padding 13px 14px, gap 12): date 800/13 · detail 400/11 `#8ea79a` · net 800/14 (`#7fd6a5` positive, `#adc2b6` negative) with "units" caption · **Reuse** button (44px min-height, outline pill, hover gold).
  - Data: "Fri 21 Aug · 6 players · 20 units in · 1,900 pts dealt · +2.00" · "Sat 15 Aug · 5 players · 10 units in · 1,000 pts dealt · −0.60" · "Fri 8 Aug · 8 players · 30 units in · 2,940 pts dealt · +3.20".
  - **Reuse** loads that game's player count and entry bet into the chip tool, clears any result, and switches to the Chips tab.
- **Log out** — plain text button, 44px, 400/11 uppercase `#6d887a`, hover `#e8cf8a`. Returns to Login.

### 9. Tab bar

- `padding: 8px 12px 14px`, `background: rgba(10,20,15,.86)`, top hairline `rgba(240,239,233,.12)`, gap 4.
- Four buttons, flex 1, 52px min-height, radius 20, column layout, gap 5: 19px Lucide icon (`home`, `trending-up`, `disc`-style concentric circle with ticks, `user`) over a 800/10 uppercase label.
- Active: `#2e6b4f` fill, `#f0efe9` ink. Inactive: transparent, `#8ea79a`, hover `#1e3228`.

---

## Interactions & behaviour

- **Auth gate**: unauthenticated → Login overlay covers everything. Any submit authenticates.
- **Tabs**: switching resets the parallax scroll offset to 0 and collapses nothing else.
- **Drill flow**: CTA (Home) or a non-locked unit row (Path) opens the overlay at question 1 with a fresh score. One answer per question, locked once chosen; wrong answers cost a heart (floor 0) and no XP; correct answers add 8 XP to both the session total and lifetime XP. "Next one" advances (with the alternating flip); after the last question the completion screen shows the session XP. Close (✕ or "Back to today") returns to the tab underneath.
- **Chip tool**: any edit to players, bet, colours, quantities, values or the Auto/Manual toggle clears the current result (the user must deal again). "Deal the stacks" runs the solver; in **Auto** mode the chosen denominations are written back into the value fields so the case list, result and Balance all agree. Dealing also seeds every seat's "End pts" with the dealt stack.
- **Balance**: editing an end count recomputes that seat's converted value, points balance and unit balance, plus the tally line. Names are local per seat and independent of the counts.
- **Responsive**: single column; the phone frame in the prototype is a presentation device, not part of the design.

## State

| State | Type | Notes |
| --- | --- | --- |
| `authed` | bool | false → Login overlay |
| `email`, `pass` | string | login fields |
| `tab` | `home \| path \| chips \| you` | active tab |
| `sy` | number | scroll offset of the active pane, drives parallax; reset on tab change |
| `hearts` | int 0–5 | lives, decremented on a wrong answer |
| `xp` | int | lifetime XP |
| `streak` | int | day streak (static in the prototype) |
| `exOpen`, `exDone` | bool | drill overlay / completion screen |
| `qi` | int | current question index |
| `chosen` | option id \| null | answer for the current question |
| `gained` | int | XP earned this drill |
| `players` | int 2–10 | seats |
| `buyIn` | int | entry **in points** (= units × 100) |
| `autoValues` | bool | Auto vs My values |
| `colors` | array of `{name, swatch, count, value}` | 2–8 entries |
| `result` | `{order, denoms, qty, val, ok, total}` \| null | last deal |
| `ends` | int[] | end-of-game points per seat |
| `names` | string[] | seat names (full) |
| `editingName` | int \| null | which name field has focus |
| `pointsPerUnit` | 100 | constant |
| `gamesOpen` | bool | Your games panel |
| `gamesTotal` | 11 | games set up (feeds both the stat and "Last 3 of 11") |

## Algorithms (port these closely)

### Chip assignment

Inputs: `players`, `buyIn` (points), `colors[]`, `autoValues`.

1. Sort colour indices ascending by value → `order`. Per-colour availability per player = `floor(count / players)`.
2. Denomination set: **Manual** → the user's values in `order`. **Auto** → try each ladder, truncated to the number of colours: `[1,2,5,10,25,50,100,250]`, `[1,5,10,25,50,100,500,1000]`, `[5,10,25,50,100,500,1000,2500]`, `[1,2,5,20,50,100,200,500]`.
3. **Greedy seed**: for denomination *i* of *n*, quantity = `min(avail[i], max(i === 0 ? 4 : 0, round(((i+1) / Σ(1..n)) × buyIn / denom[i])))` — a weighted spread that gives more of the larger chips. Then repair the total: while it is under, add the largest chip that fits the shortfall and still has availability; while over, remove the largest chip not exceeding the excess (else any non-zero chip). Cap 5000 iterations.
4. **Exact fallback** (only if the greedy pass misses, and `1 ≤ buyIn ≤ 4000`): bounded DP over denominations with per-denomination caps — `dp[i][sum]` reachable, `cnt[i][sum]` = how many of denomination *i* were used — then backtrack for the quantities.
5. **Break down the DP result**: the DP lands on the fewest, largest chips. While the stack is under 20 chips, take one of the largest non-zero denomination and replace it with an exact-value combination of smaller ones (respecting availability), largest-first. Cap 300 iterations.
6. **Auto candidate choice**: prefer exact fits with ≥ 8 chips, then more distinct denominations, then a total nearest 24 chips, then the smallest error.
7. Report: `qty` per denomination (filtering zeros for display), `total` chips per player, `total × players` dealt, `case total − dealt` left in the bank, and the smallest used denomination for the blind suggestion (`v / v×2`, suppressed when `v > 5% of buyIn`).

### Balance

- `scale = buyIn / dealtStack` (e.g. 2000 / 1900 = 1.053), displayed to 3 decimals.
- Per seat: `counts as = round(endPoints × scale)` · `points balance = countsAs − buyIn` · `units = pointsBalance / 100`, shown to 2 decimals.
- Tally: `Σ endPoints` vs `dealtStack × players`; total units in play = `buyIn × players / 100`.
- Worked example from the brief: 20-unit entry (2000 points), 1900 dealt per player; finish with 3800 points → counts as 4000 → +2000 points → **+20.00 units**.

## Assets

- **Fonts**: Archivo 400/800 (Google Fonts).
- **Icons**: Lucide — `home`, `trending-up`, a concentric-circle chip mark, `user`, and an ✕ for closing. Inline SVG, `stroke-width: 2`, round caps, 19px in the tab bar, 16px for the close button.
- **Google mark**: 4-colour inline SVG (`#4285f4`, `#34a853`, `#fbbc05`, `#ea4335`) in the login button — replace with the codebase's official Google button asset for production.
- **Card figures and chips**: all drawn in inline SVG / CSS gradients in the prototype. **No bitmap images anywhere.** If the product wants real gold-foil court-card art (the user's reference), that needs commissioned or licensed artwork — the SVG figures here are geometric stand-ins.
- **Design system**: styling references the bound **Modernist** design system (`_ds/modernist-.../styles.css`) for the Archivo pairing and the red/ink hierarchy. v3 deliberately departs from it on radius, dark ground and the gold detail.

## Files

| File | What it is |
| --- | --- |
| `Poker Coach v3 felt.dc.html` | **The design to implement.** Template + logic class; algorithms live in the `<script type="text/x-dc">` block near the bottom. |
| `Poker Coach v2.dc.html` | Earlier light playful version — context only. |
| `Poker Coach.dc.html` | Earliest flat Modernist version, plus two alternate visual treatments — context only. |
| `bg-a-line-court.dc.html`, `bg-b-blocky-court.dc.html`, `bg-c-card-silhouette.dc.html` | The three background-figure explorations; **C** was chosen and is what v3 implements. |
| `support.js` | Prototype runtime. **Do not port.** |
| `screens/` | Reference captures of v3 at 2× (390 × 844 design size): `01-login`, `02-home`, `03-path`, `04-drill-question`, `05-drill-answered` (correct + wrong states together), `06-chips-setup`, `07-chips-result-balance`, `08-balance`, `09-you` (Your games open). In 07 and 08 the sections above are hidden to frame the result and Balance — they are not separate screens. |

## Open items

- Lessons content is three questions in one unit; the other four units are placeholders with no drills.
- Streak, XP, accuracy, week chart, mastery percentages and the games list are static sample data — no persistence anywhere.
- "Your games" is not written by the chip tool; setting up a game does not append to it.
- Seat names are not carried into the tally line, the games list, or anywhere outside the Balance rows.
- No sign-up, password reset, or real Google OAuth.
