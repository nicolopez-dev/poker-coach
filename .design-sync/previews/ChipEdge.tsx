import { Chip, ChipEdge, StyleSheet, Text, View, colors, font } from 'poker-coach';

const rows = [
  { swatch: '#f4f1e6', value: 5, qty: 8 },
  { swatch: '#ff7a63', value: 10, qty: 6 },
  { swatch: '#4a6b52', value: 25, qty: 4 },
  { swatch: '#3a4f6b', value: 50, qty: 2 },
  { swatch: '#1a1a1a', value: 100, qty: 1 },
];

/**
 * The Balance card's stacks: the top chip, then one edge per chip under it (at most
 * four), then the count and the value.
 */
export const BalanceStacks = () => (
  <View style={styles.stacks}>
    {rows.map((r) => (
      <View key={r.value} style={styles.stack}>
        <View style={styles.stackChips}>
          <Chip size={30} swatch={r.swatch} value={r.value} />
          {Array.from({ length: Math.min(4, r.qty - 1) }, (_, i) => (
            <ChipEdge key={i} swatch={r.swatch} />
          ))}
        </View>
        <Text style={styles.stackQty}>×{r.qty}</Text>
        <Text style={styles.stackValue}>{r.value} pts</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  stacks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', rowGap: 16, columnGap: 14 },
  stack: { alignItems: 'center', gap: 7 },
  stackChips: { alignItems: 'center', gap: 2 },
  stackQty: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, color: colors.textSecondary },
  stackValue: { fontFamily: font.regular, fontSize: 9, lineHeight: 11, color: colors.textMuted },
});
