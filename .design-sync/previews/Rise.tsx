import { Rise, Suit, Text, View, colors, font, ls, radius } from 'poker-coach';

/**
 * `rise` — translateY 14 → 0 with a fade, 350ms by default. Feedback cards and whole
 * screens arrive this way; `delay` staggers a column.
 */
export const Feedback = () => (
  <Rise duration={300}>
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.goldRule,
        backgroundColor: colors.reward,
        paddingVertical: 16,
        paddingHorizontal: 18,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <Suit glyph="♠" size={14} color={colors.gold} />
        <Text style={{ fontFamily: font.bold, fontSize: 13, lineHeight: 15, color: colors.textOnReward }}>
          Right — fold
        </Text>
      </View>
      <Text style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
        Calling €30 to win €90 needs 25% equity; a busted draw has none.
      </Text>
    </View>
  </Rise>
);

/** A staggered column. */
export const Staggered = () => (
  <View style={{ gap: 8 }}>
    {['Pre-flop ranges', 'Pot odds', 'Position'].map((t, i) => (
      <Rise key={t} delay={i * 80}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.row, padding: 16 }}>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 10,
              letterSpacing: ls(10, 0.12),
              textTransform: 'uppercase',
              color: colors.textMuted,
            }}>
            Chapter {i + 1}
          </Text>
          <Text style={{ fontFamily: font.bold, fontSize: 17, lineHeight: 20, color: colors.text }}>{t}</Text>
        </View>
      </Rise>
    ))}
  </View>
);
