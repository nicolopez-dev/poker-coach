import { SilverFrame, StyleSheet, Suit, Text, View, colors, font, ls, radius } from 'poker-coach';

const HEART = 180;

/**
 * The Hand of the day's cover. Silver belongs to this one card — gold marks a reward,
 * and this is a question on the way past.
 */
export const HandOfTheDayCover = () => (
  <SilverFrame radius={radius.card} innerStyle={styles.cover}>
    <Suit glyph="♥" size={HEART} color="rgba(255,86,60,.16)" style={styles.heart} />
    <View>
      <Text style={styles.coverTitle}>Hand of the day</Text>
      <Text style={styles.coverHint}>Flip to play →</Text>
    </View>
  </SilverFrame>
);

/** The question face: kicker and chapter badge, then the prompt. */
export const QuestionFace = () => (
  <SilverFrame radius={radius.card} innerStyle={{ padding: 18 }}>
    <View style={styles.head}>
      <Text style={styles.kicker}>Hand of the day</Text>
      <Text style={styles.badge}>Pot odds</Text>
    </View>
    <Text style={styles.prompt}>
      €30 into a €60 pot on the river. How often do you need to win for a call to break even?
    </Text>
  </SilverFrame>
);

const styles = StyleSheet.create({
  cover: { padding: 18, minHeight: 190, justifyContent: 'flex-end', overflow: 'hidden' },
  heart: { position: 'absolute', right: -10, top: '50%', marginTop: -HEART / 2, lineHeight: HEART },
  coverTitle: {
    fontFamily: font.bold,
    fontSize: 26,
    lineHeight: 26 * 1.05,
    letterSpacing: ls(26, -0.02),
    color: colors.text,
    maxWidth: 150,
    marginBottom: 10,
  },
  coverHint: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.1),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.14),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  badge: {
    fontFamily: font.bold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.08),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  prompt: { fontFamily: font.bold, fontSize: 17, lineHeight: 17 * 1.25, color: colors.text },
});
