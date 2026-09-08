# Handoff Update 02 — Poker Coach (felt)

**This is an incremental update. It does not replace `design_handoff_poker_coach/`.**
That first package still describes the app as a whole (all screens, tokens, flows). This one
documents **only what changed since it**, screen by screen, so an implementation built from
package 01 can be updated in place.

Date: 2026-09-08 · Source design: `design/Poker Coach v3 felt.dc.html`

## About the design files

The files in `design/` are **design references written in HTML** — a prototype of the intended
look and behavior, not production code to copy. Recreate the changes in the target codebase using
its existing environment and patterns (React/Vue/SwiftUI/native). If no environment exists yet,
pick the appropriate framework and implement there.

Fidelity: **high** — colors, type, spacing and timings below are final and exact.

## How to apply this update

Work screen by screen. Each section below states the **previous behavior** and the **new
behavior**. Nothing outside these sections changed; leave the rest of the implementation alone.

Affected screens: **Home**, **Drill (lesson question)**, **Chips (setup + balance)**, **You**.
Unaffected: Login, Path.

---

## 1. Home

### 1.1 "Today's ante" is now "Today's streak" (copy only)

| Was | Now |
| --- | --- |
| `Today's ante` | `Today's streak` |
| `How the ante works` | `How the streak works` |
| `Five drills is the ante.` | `Five drills is the streak.` |
| `Today's ante is paid. Come back tomorrow to keep the run alive.` | `Today's streak is locked. Come back tomorrow to keep the run alive.` |
| `Ante paid. Anything else today is profit.` | `Streak locked. Anything else today is profit.` |
| `… left to pay today's ante` | `… left to lock today's streak` |

The word "ante" no longer appears in the product. Rename any identifier that carries it
(`anteRot`, `anteChips`…) only if convenient — behavior is unchanged.

### 1.2 Streak card: decorative spade

Front face only (the side with the chip row), inside the card's `overflow: hidden` box:

- Glyph `♠`, `font-size: 232px`, `line-height: 1`, color `rgba(232,207,160,.16)`
- Positioned `right: -14px; top: 50%; transform: translateY(-50%)` (vertically centered)
- `pointer-events: none; user-select: none`
- Must **not** appear on the back face ("How the streak works")

### 1.3 Streak card sizes to content

The card was a fixed `258px` tall box with both faces absolutely positioned. Now:

- Flip container: `position: relative; width: 100%; min-height: 200px; transform-style: preserve-3d`
- Front face: **in normal flow** (`position: relative`) so the card is as tall as its content
- Back face: `position: absolute; inset: 0; transform: rotateY(180deg)`

Result: the gap under the "Keep dealing" button equals the card's own 20px padding instead of
a ~40px dead strip.

### 1.4 Your rank (Home) — 3D chip, pinned to the live rank

The flat 56px chip circle is replaced by the interactive 3D chip (spec in §5).
**Home's rank card must never follow the ladder selection on the You tab.** It always renders the
user's live rank: level label, swatch, milled edge, progress bar (`#57b183`), and
"N XP to <next rank>". Keep its values in a separate binding from the You card's.

### 1.5 Hand of the day — scroll reveal + flip-to-play

**Previously:** the question card was visible immediately, options tappable straight away.

**Now** it is a two-sided card, `perspective: 1400px` on the wrapper:

*Reveal on scroll*
- Initial: `opacity: 0; transform: translateY(30px) scale(.96)`
- Revealed: `opacity: 1; transform: translateY(0) scale(1)`
- Transition: `opacity .5s ease, transform .55s cubic-bezier(.2,.8,.2,1)`
- Trigger: the card enters the scroll container's viewport by ~30% of its height (IntersectionObserver
  with the tab scroller as root, plus a scroll-listener fallback). One-shot — never re-hides.

*Faces*
- Question face (unchanged content) is the **front**, un-mirrored, `rotateY(0)`
- Cover face is the **back**, `transform: rotateY(180deg)`
- Container resting transform: `rotateY(180deg)` (cover showing); flipped: `rotateY(0deg)`
- Transition `transform .55s cubic-bezier(.2,.8,.2,1)`
- Both faces `backface-visibility: hidden`, and **hit testing must be gated by flip state**:
  the hidden face gets `pointer-events: none`. Without this the cover swallows taps and the
  options are unanswerable.

*Flip gesture*
- **Swipe left or right only** (horizontal pointer delta > 40px). Tap does **not** flip — a tap
  must reach the answer options.
- `touch-action: pan-y` so vertical scrolling still works.

*Cover face design*
- Ground: flat `#1d4433` (differs from the app background), no gradient wash
- Border: 1px silver hairline — `background-image: linear-gradient(#1d4433,#1d4433), linear-gradient(115deg,#5d6470 0%,#e6ebf0 36%,#aab3bd 62%,#5a6270 100%)` with
  `background-origin: border-box; background-clip: padding-box, border-box; border: 1px solid transparent`
- Radius `26px`, padding `18px`, `overflow: hidden`
- Only background mark: the joker face asset (`design/joker-face.png`), `width: 196px`,
  `right: -16px; bottom: -14px`, `opacity: .92`, `filter: drop-shadow(0 6px 14px rgba(0,0,0,.45))`,
  `pointer-events: none`
- Title `Hand of the day` — Archivo 800, 26px/1.05, `-.02em`, `#f0efe9`, `max-width: 11ch`
- Hint `Flip to play →` — Archivo 800, 11px, `.1em`, uppercase, `#e8cf8a`
- Content sits bottom-aligned (`justify-content: flex-end`)

*Section spacing*
- Section padding-top reduced `16px → 6px` so the card sits closer to the streak card above.

---

## 2. Drill (lesson question)

### 2.1 Held cards replace the "you hold …" string

Any question where the player holds cards now shows those cards as a small fanned hand
**above the answer options**, from the player's point of view. The board cards stay in the row at
the top of the question (their label changed from "Your two cards, then the board" to **"The board"**).

Data shape: the question gains `hole: [{rank, suit, ink}, {rank, suit, ink}]`. Render the hand only
when exactly two hole cards exist.

*Geometry (resting)*
- Clipping box: `position: relative; width: 150px; overflow: hidden`, height `84px`
- Each card: `52 × 72px`, radius `12px`, background `#f4f1e6`, shadow `0 3px 12px rgba(0,0,0,.55)`
- Rank top-left (Archivo 800, 17px), suit bottom-right (16px); ink `#17181a` black suits,
  `#b5121f` red suits
- Both cards `position: absolute; left: 50%; bottom: -14px; margin-left: -26px`; left card z-index 2,
  right card z-index 1 (minimal overlap, slightly shifted)
- Caption under the hand: `Your hand` — Archivo 400, 10px, `.08em`, uppercase, `#8ea79a`

*Deal-in animation (on question appear)*
1. `holeup` — `.5s cubic-bezier(.2,.8,.2,1)` both: `translateY(120px) → 0`, opacity 0 → 1
   (one card rises from the bottom edge)
2. then at `.48s`, `.38s cubic-bezier(.2,.8,.2,1)` both, the pair splits:
   - left card `holeleft`: `translate(-20px,-3px) rotate(-8deg)`
   - right card `holeright`: `translate(20px,-3px) rotate(8deg)`

**Do not change this intro animation when implementing the tap state below.**

### 2.2 Tap to open the hand (two states)

Tapping the hand toggles between two states; the transition reverses exactly.

- Closed (default): transforms above, container height `84px`
- Open: container height `102px`; left card `translate(-11px,-24px) rotate(8deg) scale(1.1)`,
  right card `translate(11px,-24px) rotate(-8deg) scale(1.1)` — cards sit side by side, upright,
  slightly larger, centered, fully clear of the "Your hand" caption
- Transition: `transform .38s cubic-bezier(.2,.8,.2,1)` on the cards,
  `height .38s cubic-bezier(.2,.8,.2,1)` on the container
- `transform-origin: 50% 100%`, `cursor: pointer`

State: one boolean per question (`holeOpen`).

Screenshot: `screens/01-drill-held-cards.png`

---

## 3. Chips — setup

### 3.1 Unit / stack / case moved out of "Entry bet"

Previously these three facts were stacked inside the Entry bet card, which made the Players card
stretch to match. They are now **one quiet line below both cards**:

- Container: `display: flex; flex-wrap: wrap; gap: 4px 16px; margin: -4px 2px 16px`
- Type: Archivo 400, 10px/1.5, `#6d887a`; values Archivo 800, `#adc2b6`; each item `white-space: nowrap`
- Content: `1 unit = 100 pts` · `Stack <buyIn> pts` · `Case <availPts>`
  (`availPts` already carries its own "pts each" suffix — do not append it twice)

Players and Entry bet cards are now equal height.

### 3.2 Entry bet input may be emptied

- While typing, the field holds raw text (digits only, may be empty) — do not coerce to 1 per keystroke
- On **blur**, an empty field falls back to 1 unit (`buyIn = 100`)
- Any non-empty value clamps to `>= 1` unit and clears the solved result

Screenshot: `screens/02-chips-entry-bet.png`

---

## 4. Chips — Balance (gated behind "Settle")

**Previously:** the Balance panel appeared automatically as soon as stacks were solved.

**Now:**

1. After a successful deal, the Chips screen shows a single pill button:
   `Settle the table →` — full width, `min-height: 54px`, `border: 1.5px solid #c9a75c`,
   transparent ground, ink `#e8cf8a`, uppercase Archivo 800 12px/.08em; hover ground `#1d4433`
2. Tapping it opens the Balance panel (same content as before, changes below)
3. The panel closes/resets whenever a new deal is solved or a saved game is loaded

### 4.1 Balance column shows units first

The right-hand column is now **units-led** — points are the small line underneath:

- Header for that column: `Units` (was `Balance`)
- Big figure: signed units to 2 decimals, no suffix (e.g. `+1.40`, `−0.60`), Archivo 800 15px
- Small line: `<points> pts`, Archivo 400 10px, `#8ea79a`
- Positive ink: `#e8cf8a` (gold/white family). Negative: `#adc2b6`. Level: `#6d887a`

### 4.2 Row backgrounds

- Winner (net > 0): ground `#0b1210`, `border: 1px solid #c9a75c`
- Loser (net < 0): ground `#33201a`, no border (the red ground now belongs to players who lost units)
- Even: ground `#16261e`, no border

### 4.3 Settle button

Sits at the bottom of the Balance panel, full width, `min-height: 54px`, radius `999px`,
uppercase Archivo 800 12px/.08em.

| State | Condition | Style | Label | Helper line |
| --- | --- | --- | --- | --- |
| Disabled | end counts ≠ points dealt | bg `#1e3228`, ink `#6d887a`, `cursor: not-allowed` | `Settle game` | `Recount — the chips on the table do not match the points dealt.` |
| Enabled | every point accounted for | bg `#e8cf8a`, ink `#0b1210`, `cursor: pointer` | `Settle game` | `Every point accounted for. Settling saves this game.` |
| Saved | after tap | bg `#1d4433`, ink `#7fd6a5` | `Game saved ✓` | `Filed under Your games on the You tab.` |

Helper line: centered, Archivo 400 10px/1.4, `#6d887a`.

Balanced test: `sum(endPoints) === pointsPerStack * players`.
Settling saves the game to **Your games** and increments the games counter. Editing any seat total
after saving returns the button to its unsaved state.

---

## 5. You

### 5.1 3D rank chip (shared with Home)

One interactive chip component, used on both the Home rank card and the You rank card. It is
entertainment only — no data changes from interacting with it.

- Mount: `72 × 72px`, `perspective: 420px`, `cursor: grab`, `touch-action: none`, `user-select: none`
- Body: `transform-style: preserve-3d`, `transform: rotateX(rx) rotateY(ry)`
- Faces (both `border-radius: 50%`, `backface-visibility: hidden`, ground = milled edge gradient
  `repeating-conic-gradient(from 0deg, <dash> 0 8deg, <swatch> 8deg 30deg)`):
  - front `translateZ(5px)`, inner disc `inset: 7px`, swatch ground, 1px `rgba(255,255,255,.45)` ring,
    label = **level as `L1`…`L5`** (Archivo 800 18px)
  - back `rotateY(180deg) translateZ(5px)`, same disc, glyph `♠` (Archivo 800 20px)
- Milled rim: 24 segments, each `10 × 11px`, `transform: rotateZ(i*15deg) translateX(36px) rotateY(90deg)`,
  alternating dash/swatch color
- Rest angle: `rotateX(-14deg) rotateY(-18deg)`

*Interaction*
- Drag: `rx -= dy * 0.6`, `ry += dx * 0.8`, no transition while dragging (pointer capture)
- Tap (movement < 6px): `ry += 180` — flips the chip
- Idle spin: `ry += 1.1deg` every 55ms (~20°/s) while untouched, no transition
- After interaction: 1.6s idle, then ease back to the rest angle over
  `.6s cubic-bezier(.2,.8,.2,1)` and resume the idle spin. Applies to **both** instances.

**The chip label must reflect the selected rank** (L1 on a white chip, L3 on a green chip, …) —
not always the live level.

### 5.2 Chip ladder

- The row scrolls horizontally and shows **cleared ranks, the current rank, and the next one only**
  (`ranks.slice(0, currentIndex + 2)`); the next chip renders in a disabled state
  (swatch `opacity: .38`, title ink `#6d887a`, meta `Locked · <n> XP`, not tappable)
- Each card gains a level label above the name: `L1`, `L2`, … — Archivo 800 9px, `.12em`,
  ink `#e8cf8a` when reached, `#6d887a` when locked
- Tapping a **cleared or current** chip retargets the You rank card:
  - chip takes that rank's colors and level
  - progress bar fills to `100%` in gold `#c9a75c` (live rank keeps `#57b183`)
  - note becomes `Mastered · tap your current chip to go back`
  - tapping the current chip returns to live XP
  - selected card: ground `#0b1210`, border `#c9a75c`
- **Home's rank card must not react to this** (see §1.4)

### 5.3 "Show ladder" card (full ladder)

A hint sits bottom-right of the ladder section: text button `Show ladder` / `Hide ladder`,
Archivo 800 10px, `.1em`, uppercase, `#e8cf8a`, transparent ground.

Opening reveals a minimal card (`animation: pop .3s ease both`):
- Card: radius `20px`, ground `#0b1210`, `border: 1px solid rgba(240,239,233,.10)`, padding `6px 14px`
- One row per rank, `padding: 11px 8px`, radius `12px`; current rank row ground
  `rgba(232,207,160,.07)`
- Row: 11px swatch dot (`opacity: .3` when locked) · level `L1` (Archivo 800 10px, `#8ea79a`) ·
  rank name (Archivo 800 12px; `#f0efe9` reached, `#6d887a` locked) · state at the right
  (`Cleared` / `Current` / `<n> XP`, Archivo 400 10px, `#8ea79a`)

### 5.4 Stats grid redesigned

Total XP / Day streak / Accuracy / Games set up were four separate colored rounded cards. Now they
are **one card divided by hairlines**:

- Card: radius `24px`, ground `#16261e`, `overflow: hidden`, `display: grid; grid-template-columns: 1fr 1fr`
- Cell: `padding: 18px 16px`; hairlines `1px solid rgba(240,239,233,.08)` on the inner edges only
  (top border on the bottom row, left border on the right column)
- Cell content, top to bottom:
  1. 6px status dot + label — Archivo 400 9px, `.14em`, uppercase, `#8ea79a`
  2. value — Archivo 800 27px/1, `-.02em`, `#f0efe9`
  3. note — Archivo 400 10px, `#6d887a`
- Cells: Total XP (dot `#57b183`, note = rank name) · Day streak (`#e8cf8a`, `7d`, note `Best 12d`) ·
  Accuracy (`#7fd6a5`, note `Last 50 drills`) · Games set up (`#8ea79a`, note `All time`)

Screenshot: `screens/03-you-stats-rank.png`

---

## Tokens introduced or reused in this update

| Purpose | Value |
| --- | --- |
| Cover ground (Hand of the day) | `#1d4433` |
| Silver hairline | `linear-gradient(115deg,#5d6470 0%,#e6ebf0 36%,#aab3bd 62%,#5a6270 100%)` |
| Gold accent / enabled action | `#e8cf8a`, border `#c9a75c` |
| Winner row ground | `#0b1210` |
| Loser row ground | `#33201a` |
| Mastered bar fill | `#c9a75c` |
| Live bar fill | `#57b183` |
| Card ground | `#16261e` · sunken `#0b1210` · input `#1e3228` |
| Muted ink | `#8ea79a` · dimmer `#6d887a` · body `#f0efe9` |
| Playing-card face | `#f4f1e6`, black `#17181a`, red `#b5121f` |
| Standard easing | `cubic-bezier(.2,.8,.2,1)` |
| Typeface | Archivo (400 / 800) |

## Animations added

| Name | Definition |
| --- | --- |
| `holeup` | `0% {translateY(120px); opacity 0} 60% {opacity 1} 100% {translateY(0); opacity 1}` |
| `holeleft` | `0% {none} 100% {translate(-20px,-3px) rotate(-8deg)}` |
| `holeright` | `0% {none} 100% {translate(20px,-3px) rotate(8deg)}` |

## State added

| Key | Purpose |
| --- | --- |
| `holeOpen` | held-hand open/closed (Drill) |
| `hotdSeen` | Hand of the day scroll reveal fired |
| `hotdFlip` | 0 = cover, 1 = question |
| `chipRX`, `chipRY`, `chipDrag`, `chipTouched`, `chipTouchedAt`, `chipReturning` | 3D chip rotation + idle logic |
| `viewRank` | ladder selection for the You rank card (null = live rank) |
| `ladderOpen` | full-ladder card open |
| `settleOpen` | Balance panel revealed |
| `settled` | game saved from this balance |
| `betRaw` | in-progress entry-bet text (null = derive from `buyIn`) |

## Assets

- `design/joker-face.png` — 160 × 200px joker face, cropped from the user's own joker sprite sheet
  (`uploads/pasted-1788866861951-0.png`). Used only as the Hand of the day cover mark. If the target
  app has a licensed illustration set, swap it for the equivalent asset there.

## Files in this package

- `design/Poker Coach v3 felt.dc.html` — current prototype (all screens, post-update)
- `design/support.js` — runtime the prototype needs to open in a browser
- `design/joker-face.png` — cover asset
- `screens/01-drill-held-cards.png` — held hand above the answer options
- `screens/02-chips-entry-bet.png` — Chips setup with the moved unit/stack/case line
- `screens/03-you-stats-rank.png` — new stats grid and 3D rank chip

Not screenshotted (spec above is exact and self-sufficient): the Hand of the day cover and its flip,
the Balance panel with the Settle button, and the expanded ladder card. Open the prototype and swipe
the Hand of the day card / deal on Chips → "Settle the table" / You → "Show ladder" to see them live.
