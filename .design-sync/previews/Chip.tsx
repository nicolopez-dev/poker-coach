import { Chip, View } from 'poker-coach';

const CASE = [
  { swatch: '#f4f1e6', value: 5 },
  { swatch: '#ff7a63', value: 10 },
  { swatch: '#4a6b52', value: 25 },
  { swatch: '#3a4f6b', value: 50 },
  { swatch: '#1a1a1a', value: 100 },
];

/** The default case, at the result card's size: dashed edge, inset face, value printed. */
export const DefaultCase = () => (
  <View style={{ flexDirection: 'row', gap: 10 }}>
    {CASE.map((c) => (
      <Chip key={c.value} size={32} swatch={c.swatch} value={c.value} />
    ))}
  </View>
);

/** The spare colours a case can add. */
export const SpareColours = () => (
  <View style={{ flexDirection: 'row', gap: 10 }}>
    {['#6b4a7a', '#d97b2b', '#8a8a8a', '#c9628a', '#2f7d7a', '#d8b23a'].map((s, i) => (
      <Chip key={s} size={32} swatch={s} value={[250, 500, 1000, 5, 10, 25][i]} />
    ))}
  </View>
);

/** Sizes, and a blank chip (no `value`). */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Chip size={24} swatch="#ff7a63" value={10} />
    <Chip size={30} swatch="#ff7a63" value={10} />
    <Chip size={44} swatch="#ff7a63" value={10} />
    <Chip size={64} swatch="#ff7a63" />
  </View>
);
