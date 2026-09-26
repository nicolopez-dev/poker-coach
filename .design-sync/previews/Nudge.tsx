import { Nudge, Suit, Text, View, colors, font, ls, radius } from 'poker-coach';

/**
 * A refusal: `shake` at half the amplitude and twice the rate, played only when `count`
 * changes after mount — a grid of locked cells must not all shiver on arrival. The You
 * tab's mastery grid wraps each locked cell and bumps `count` on a press.
 */
export const LockedCell = () => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {['Position', 'Pot odds', 'Bluffing'].map((t, i) => (
      <Nudge key={t} count={0} style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: i === 2 ? colors.surfaceLocked : colors.surface,
            borderRadius: radius.smallCard,
            padding: 14,
            gap: 8,
            minHeight: 96,
          }}>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 9,
              letterSpacing: ls(9, 0.1),
              textTransform: 'uppercase',
              color: colors.textMuted,
            }}>
            Chapter {i + 1}
          </Text>
          <Text style={{ fontFamily: font.bold, fontSize: 14, lineHeight: 17, color: i === 2 ? colors.textFaint : colors.text }}>
            {t}
          </Text>
          {i === 2 ? <Suit glyph="♠" size={14} color={colors.textFaint} /> : null}
        </View>
      </Nudge>
    ))}
  </View>
);
