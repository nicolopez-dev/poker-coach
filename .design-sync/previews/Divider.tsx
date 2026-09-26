import { Divider, GoldFrame, StyleSheet, Text, View, colors, font, radius } from 'poker-coach';

const rows = ['Pre-flop ranges', 'Pot odds', 'Position'];

/** The default 1px hairline between rows on a surface. */
export const BetweenRows = () => (
  <View style={styles.card}>
    {rows.map((r, i) => (
      <View key={r}>
        {i > 0 && <Divider />}
        <Text style={styles.row}>{r}</Text>
      </View>
    ))}
  </View>
);

/** Restyled for a reward surface (the result card): brighter, with room around it. */
export const OnReward = () => (
  <GoldFrame radius={radius.hero} innerStyle={{ padding: 18 }}>
    <Text style={styles.row}>21 chips, worth 500 points</Text>
    <Divider style={{ backgroundColor: 'rgba(240,239,233,.25)', marginVertical: 12 }} />
    <Text style={styles.row}>Blinds: 5 / 10</Text>
  </GoldFrame>
);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18 },
  row: { fontFamily: font.bold, fontSize: 15, lineHeight: 18, color: colors.text, paddingVertical: 10 },
});
