import { Chip, NumberField, Text, View, colors, font } from 'poker-coach';

const noop = () => {};

/** A chip's value in the chip tool. */
export const ChipValue = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Chip size={32} swatch="#4a6b52" value={25} />
    <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.textSecondary }}>
      Green
    </Text>
    <NumberField value="25" onChangeText={noop} width={62} />
  </View>
);

/** A Balance row's end-of-night points. */
export const BalanceRow = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: colors.text }}>Seat 3</Text>
    <Text style={{ fontFamily: font.regular, fontSize: 12, color: colors.textMuted }}>in 500</Text>
    <NumberField value="740" onChangeText={noop} width={62} />
  </View>
);

/** Empty, waiting for a number. */
export const Empty = () => (
  <View style={{ flexDirection: 'row' }}>
    <NumberField value="" placeholder="0" onChangeText={noop} width={62} />
  </View>
);
