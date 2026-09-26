import { ProgressBar, RankChip, StyleSheet, Text, View, colors, font, ls, radius } from 'poker-coach';

/**
 * Home's rank card: the 3D rank chip (it spins until touched, and can be dragged) beside
 * the rank name and the bar to the next one.
 */
export const RankCard = () => (
  <View style={styles.card}>
    <RankChip rankIndex={2} accessibilityLabel="Green chip" />
    <View style={{ flex: 1 }}>
      <Text style={styles.kicker}>Your rank</Text>
      <Text style={styles.name}>Green chip</Text>
      <ProgressBar pct={45} height={8} style={{ marginBottom: 7 }} />
      <Text style={styles.note}>550 xp to Blue chip</Text>
    </View>
  </View>
);

/** The five ranks, White to Black. */
export const Ladder = () => (
  <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <RankChip key={i} rankIndex={i} size={60} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surfaceDeep,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
  name: { fontFamily: font.bold, fontSize: 18, lineHeight: 18 * 1.1, color: colors.text, marginBottom: 9 },
  note: { fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: colors.textFaint },
});
