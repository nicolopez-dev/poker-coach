# Poker Coach — how to build with this design system

These are the app's real React Native components, running on the web through
react-native-web. Everything is on `window.PokerCoach`: the components, the RN primitives
the screens compose with (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`,
`StyleSheet`, `Animated`), and the tokens (`colors`, `font`, `type`, `radius`, `spacing`,
`shadows`, `ls`, `goldGradient`, `rewardCardFill`, `absoluteFill`, `TOUCH`).

## Setup: wrap the screen, paint the ground

- Wrap every design in `SafeAreaProvider`. `Header` and `TabBar` read safe-area insets
  and fail without it. Pass `initialMetrics` so it renders on the first frame.
- It is a dark app. Everything is light-on-dark, so a design on a white page is
  unreadable. Give the root `colors.ground`, or lay `<Felt />` (absolute fill) under a
  screen. `BackgroundCards` (the two drifting aces) sits behind tab content.
- Phone column: `spacing.screen` (paddingTop 66 clears the absolute `Header`, 18 at the
  sides), content capped at `spacing.maxContentWidth` (480).

## Styling idiom: RN style objects built from the tokens

Style with `style={...}` / `StyleSheet.create`, never class names on RN components.
Numbers are px, and `lineHeight` is px, not a multiplier. Letter spacing is
`ls(fontSize, em)`.

- Colour: `colors.ground | surface | surfaceDeep | surfaceInput | text | textSecondary |
  textMuted | textFaint | gold | goldRule | reward | rewardAlt | green | greenDeep |
  greenMid | red | crimson | cardFace | cardInk | cardRed | hairline | hairlineStrong`.
- Type: spread `type.screenTitle | heroTitle | resultHeadline | sectionHeading |
  bigNumber | statNumber | rowTitle | body | bodySmall | kicker | micro | buttonLabel`.
  Families are `font.regular` (Archivo 400) and `font.bold` (Archivo 800); there is no
  other weight.
- Shape: `radius.hero | card | smallCard | row | input | pill | tile`. Depth:
  `...shadows.card | big | row | chip`.
- For DOM glue outside RN components, `styles.css` defines the same values as
  `var(--pc-*)` (for example `--pc-ground`, `--pc-gold-rule`, `--pc-radius-card`,
  `--pc-gold-gradient`) and the type scale as `.pc-type-*` classes
  (`.pc-type-hero-title`, `.pc-type-kicker`, …).

## Colour rules (the brand depends on them)

- **Red** is only for the one chip action (`RedButton`), hearts (`HeartsPill`), the
  "Playing" badge, focus rings in the chip tool, and Balance rows of seats that lost units.
  Nothing else is red.
- **"Good" or reward** is near-black with white text and a 1px gold hairline: `GoldFrame`,
  `RewardCard`, `RewardButton`. Never a green fill. **Silver** (`SilverFrame`) belongs to
  the Hand of the day only.
- **Green** is felt, surfaces and thin progress fills (`ProgressBar`).
- Suit pips always go through `<Suit glyph size color />`. Archivo has no card glyphs.

## Where the truth lives

Read `components/<group>/<Name>/<Name>.prompt.md` (usage and verified examples) and
`<Name>.d.ts` (props) before using a component. Tokens are in `styles.css` →
`_ds_bundle.css`. Fonts are in `fonts/fonts.css`. The motion set wraps children:
`Rise`, `Pop`, `ChipDrop` and `Shake` play on mount and replay when `replayKey` changes;
`Flip` turns in by `index`; `Nudge` plays only when `count` changes; `Tilt` and `Glow` loop.

## Example

```jsx
const { SafeAreaProvider, View, Text, StyleSheet, Header, RewardCard, RewardButton,
  ProgressBar, colors, type, radius, spacing } = window.PokerCoach;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, ...spacing.screen, gap: 16 },
  card: { padding: 20 },
});

export default () => (
  <SafeAreaProvider style={{ flex: 1 }} initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <View style={s.screen}>
      <Header streak={12} hearts={4} />
      <Text style={type.screenTitle}>Today</Text>
      <RewardCard radius={radius.hero} innerStyle={s.card}>
        <Text style={[type.kicker, { marginBottom: 8 }]}>Chapter 3 · Lesson 4</Text>
        <Text style={type.heroTitle}>Pot odds on the river</Text>
      </RewardCard>
      <ProgressBar pct={40} />
      <RewardButton label="Start the drill" glyph="♠" onPress={() => {}} />
    </View>
  </SafeAreaProvider>
);
```
