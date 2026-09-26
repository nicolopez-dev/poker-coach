import { Suit, View, colors } from 'poker-coach';

/**
 * Suit pips render in the platform font — Archivo has no card glyphs. Red suits take
 * `cardRed` on a card face, black ones `cardInk`; on the felt they take the UI colours.
 */
export const OnACard = () => (
  <View style={{ flexDirection: 'row', gap: 10 }}>
    {(['♠', '♥', '♦', '♣'] as const).map((s) => (
      <View
        key={s}
        style={{
          width: 46,
          height: 46,
          borderRadius: 10,
          backgroundColor: colors.cardFace,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Suit glyph={s} size={24} color={s === '♥' || s === '♦' ? colors.cardRed : colors.cardInk} />
      </View>
    ))}
  </View>
);

/** On the felt: gold for reward, green for the calm states, red only for hearts. */
export const OnTheFelt = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    <Suit glyph="♠" size={32} color={colors.gold} />
    <Suit glyph="♠" size={32} color={colors.green} />
    <Suit glyph="♥" size={32} color={colors.red} />
    <Suit glyph="♣" size={32} color={colors.text} />
  </View>
);

/** Sizes: 11 in a pill, 15–16 in a button circle, 64 on an empty state. */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
    {[11, 16, 24, 40, 64].map((size) => (
      <Suit key={size} glyph="♠" size={size} color={colors.text} />
    ))}
  </View>
);
