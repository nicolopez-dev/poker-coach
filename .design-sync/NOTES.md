# design-sync notes — Poker Coach

Repo-specific knowledge for syncing this app's components to claude.ai/design
(project `75f67686-0430-443d-a0ee-6605a5237d33`). Read before any re-sync.

## How this repo is synced

- **It is an Expo app, not a library.** There is no `dist/`. `cfg.buildCmd`
  (`node .design-sync/build-dist.mjs`) makes one under `.ds-sync/dspkg/`: `.design-sync/ds-entry.ts`
  bundled for the web with `react-native` → `react-native-web` and `.web.*` files first (the
  same resolution Expo's web target uses), `tsc` declarations hoisted to `types/index.d.ts`,
  `src/theme/tokens.ts` rendered to `styles/tokens.css`, and the two Archivo cuts App.tsx loads
  copied to `fonts/`. The converter then runs with
  `--entry ./.ds-sync/dspkg/dist/index.mjs --node-modules ./node_modules`.
- **The public surface is `.design-sync/ds-entry.ts`.** Adding a component to the design system
  means exporting it there, adding a `docsMap` group stub entry, and (if it shares a file with
  other exports) a `componentSrcMap` pin. `TabScreen` and `VerifyBanner` are deliberately left out:
  they need the store and a signed-in session.
- **RN primitives ship on the global but are not cards**: `View`, `Text`, `Pressable`,
  `ScrollView`, `TextInput`, `StyleSheet`, `Animated`, `SafeAreaProvider` are exported so designs
  compose the way the screens do; `componentSrcMap: null` keeps them out of the component list.
- **`componentSrcMap` pins** exist because the converter's source match is by filename: everything
  in `ui.tsx`, `Gold.tsx`, `anim.tsx`, `icons.tsx` (and `ChipEdge`, `ChipDisc`) would otherwise
  lose its JSDoc in `.prompt.md`.
- **Groups come from `docsMap` stubs** in `.design-sync/groups/*.md` (frontmatter `category` only,
  empty body — a non-empty body would replace the synthesized doc and drop the JSDoc/examples).
- **`srcDir` is `../../src`** because it resolves from the dspkg dir.
- **Provider**: `SafeAreaProvider` with zero insets (Header/TabBar read insets) and
  `style: {backgroundColor: '#080d0a', padding: 16}` — the app's `ground`. Every card sits on the
  dark ground; without it `Brand`, pills and text are white-on-white. The provider is a column
  that stretches children, so content-sized pieces (pills, chips, icons) are wrapped in a
  `flexDirection: 'row'` View in their previews — that is also how the header lays them out.

## Toolchain on this machine

- Windows; no Playwright browser cache. The render check and captures use the installed Chrome:
  `DS_CHROMIUM_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"`. `playwright` is
  installed into `.ds-sync/` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- `preview-rebuild.mjs` does not regenerate `.prompt.md`: run a full `package-build.mjs` before
  uploading a batch, or its docs ship without the `## Examples` from the new previews.
- Long bash heredocs with several files tripped the shell's quote parser once; write preview
  files with the editor tool instead.
- Stop the `.review.html` server (`http-serve.mjs ./ds-bundle`) before any full
  `package-build.mjs`: on Windows it holds `ds-bundle/` open and the build dies with `EBUSY` on
  the rmdir, leaving the bundle half-deleted.

## Grading

- **`package-capture.mjs` freezes the page clock** (`page.clock.setFixedTime`), which parks every
  React Native `Animated.timing` on frame 0. Entry animations therefore capture at their start
  state — `HeldHand` shows only its caption; `Rise`/`Pop`/`ChipDrop` start invisible. In Claude
  Design the clock runs and they play. Those cells are graded from live-clock captures:
  `node .ds-sync/liveshot.mjs --components <Names> --wait 1500` (a small scratch script — recreate
  it if `.ds-sync/` was wiped: it serves `ds-bundle/`, opens each `?story=` URL without freezing
  the clock, waits, and screenshots to `ds-bundle/_screenshots/live/`).
- Countdown previews (`HeartsPill`, `StreakPill`) compute their target from `Date.now()` at module
  load, so they read the same under the frozen clock.

## Known render warns

- `SwatchPicker`: the RN `Modal` covers the whole window, so the card page's own margin shows as
  a thin grey band under the dim backdrop. Harness-only; the preview lays the app's ground under
  the sheet.
- `AceCard` flagged `[GRID_OVERFLOW]` (the tilted "Drifting" pair is wider than a grid cell);
  fixed with `overrides.AceCard.cardMode: "column"`. `SwatchPicker` (`single`, 390x420) and
  `BackgroundCards` (`single`, 390x780) are full-window by nature.

## Conventions header

`.design-sync/conventions.md` is prepended to the uploaded README (`readmeHeader`) and is what
the Claude Design agent reads first. Every name in it was checked against the built bundle's
export list and `_ds_bundle.css` on the first sync; re-validate after changing `ds-entry.ts` or
`tokens.ts`. Its colour rules restate CLAUDE.md's — keep the two in step.

## Re-sync risks

- **Previews carry copies of screen styling.** `GoldFrame` (Home streak card), `SilverFrame` and
  `FlipCard` (Hand of the day), `RewardCard` (chip result card), `ChipEdge` (Balance stacks),
  `RankChip` (rank card), `Pop`/`Shake`/`Rise` (drill answers and feedback) port style values from
  `src/screens/**`. When those screens change, the previews go stale silently — they still render.
- **Group stubs and src pins are enumerations.** A component added to `ds-entry.ts` without a
  `docsMap` entry lands in `general`; one added to a shared file without a `componentSrcMap` pin
  loses its JSDoc.
- **`build-dist.mjs` assumes** the Archivo cuts App.tsx loads are exactly `tokens.font.regular` /
  `tokens.font.bold` and live at `node_modules/@expo-google-fonts/archivo/<cut>/<Family>.ttf`, and
  that `src/theme/tokens.ts` imports nothing from react-native but `Platform`. A new weight or a
  new RN import in tokens.ts needs the script updated.
- **react-native-web is the renderer**, not the phone. Native-only behaviour (Android blur
  fallback in `headerFill`, `Modal` animation, haptics) is not what the cards show.
- **Motion cells were graded from live-clock captures**, not the frozen-clock sheets:
  `HeldHand`, `Rise`, `Pop`, `ChipDrop`, `Flip`. A re-grade must use `liveshot.mjs` for them.
- The `.prompt.md` `style` prop types flatten `StyleProp<ViewStyle>` to
  `false | "" | ViewStyle | RecursiveArray<…>`, and `string | null` props lose `| null`
  (ts-morph runs non-strict). Accurate enough for the agent; `dtsPropsFor` can override.
