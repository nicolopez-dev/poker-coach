import {
  ChipDisc,
  GoldFrame,
  Pressable,
  Sheen,
  StyleSheet,
  Suit,
  Text,
  View,
  colors,
  font,
  ls,
  radius,
  shadows,
} from 'poker-coach';

const CHIP = 30;

/**
 * Home's streak card, front face: the gold hairline around the near-black reward
 * gradient (no `fill`), a drifting sheen, the decorative spade behind everything.
 */
export const StreakCard = () => (
  <GoldFrame radius={radius.hero} innerStyle={styles.face}>
    <Sheen />
    <Suit glyph="♠" size={232} color="rgba(232,207,160,.16)" style={styles.spade} />
    <View style={styles.head}>
      <Text style={styles.kicker}>Today’s streak</Text>
      <Text style={styles.dailyLabel}>2 of 3 today</Text>
    </View>
    <View style={styles.chips}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.chipPaid}>
          <ChipDisc
            size={CHIP}
            colours={{ swatch: colors.goldRule, dash: '#ffffff' }}
            face={colors.gold}
            mark="♠"
            markInk={colors.cardInk}
          />
        </View>
      ))}
      <View style={[styles.chip, { borderColor: colors.gold }]} />
    </View>
    <Text style={styles.headline}>One more hand keeps the run alive.</Text>
    <Pressable accessibilityRole="button" style={styles.cta}>
      <Text style={styles.ctaLabel}>Play the next hand</Text>
      <View style={styles.ctaGlyph}>
        <Suit glyph="♠" size={15} color={colors.gold} />
      </View>
    </Pressable>
  </GoldFrame>
);

/** With a solid `fill` — the frame the reward buttons and the live streak pill wear. */
export const SolidFill = () => (
  <GoldFrame radius={radius.card} fill={colors.rewardAlt} innerStyle={{ padding: 18, gap: 6 }}>
    <Text style={styles.kicker}>Chapter complete</Text>
    <Text style={[styles.headline, { marginBottom: 0 }]}>Pre-flop ranges, done.</Text>
  </GoldFrame>
);

/** At pill radius, content-sized. */
export const Pill = () => (
  <View style={{ flexDirection: 'row' }}>
    <GoldFrame radius={radius.pill} fill={colors.rewardAlt}>
      <View style={styles.pill}>
        <Suit glyph="♠" size={12} color={colors.gold} />
        <Text style={styles.dailyLabel}>Double XP</Text>
      </View>
    </GoldFrame>
  </View>
);

const styles = StyleSheet.create({
  face: { padding: 20, ...shadows.big, overflow: 'hidden' },
  spade: { position: 'absolute', right: -14, top: '50%', marginTop: -116, lineHeight: 232 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.14),
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.6)',
  },
  dailyLabel: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, color: colors.gold },
  chips: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  chipPaid: { borderRadius: CHIP / 2, ...shadows.chipLarge },
  headline: {
    fontFamily: font.bold,
    fontSize: 19,
    lineHeight: 19 * 1.15,
    letterSpacing: ls(19, -0.015),
    color: colors.textOnReward,
    marginBottom: 16,
    maxWidth: 280,
  },
  cta: {
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.cardFace,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 12,
  },
  ctaLabel: { fontFamily: font.bold, fontSize: 15, lineHeight: 17, color: colors.cardInk },
  ctaGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
});
