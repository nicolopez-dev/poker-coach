import { Chip, ChipDrop, Text, View, colors, font } from 'poker-coach';

const rows = [
  { name: 'White', swatch: '#f4f1e6', value: 5, qty: 8 },
  { name: 'Red', swatch: '#ff7a63', value: 10, qty: 6 },
  { name: 'Green', swatch: '#4a6b52', value: 25, qty: 4 },
];

/**
 * `chipdrop` — translateY -18 and rotate -12° → rest, 350ms. The result card's rows drop
 * in like chips onto the felt.
 */
export const ResultRows = () => (
  <View style={{ gap: 9 }}>
    {rows.map((r) => (
      <ChipDrop key={r.name} duration={400} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Chip size={32} swatch={r.swatch} value={r.value} />
        <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, color: 'rgba(240,239,233,.85)' }}>
          {r.name}
        </Text>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.textOnReward }}>×{r.qty}</Text>
      </ChipDrop>
    ))}
  </View>
);
