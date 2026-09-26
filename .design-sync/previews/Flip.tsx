import { Flip, Text, View, colors, font, ls, radius } from 'poker-coach';

/**
 * `flipa` / `flipb` — rotateY ∓84° → 0, alternating with the question's `index`, so
 * consecutive questions turn in from opposite sides. One-shot on mount; for a card that
 * stays turned, use FlipCard.
 */
export const Question = () => (
  <Flip index={2}>
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, gap: 10 }}>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: colors.surfaceInput,
          borderRadius: radius.pill,
          paddingVertical: 5,
          paddingHorizontal: 10,
        }}>
        <Text
          style={{
            fontFamily: font.regular,
            fontSize: 9,
            letterSpacing: ls(9, 0.1),
            textTransform: 'uppercase',
            color: colors.textMuted,
          }}>
          Chapter 3 · Pot odds · 3 of 10
        </Text>
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 19, lineHeight: 23, color: colors.text }}>
        The river bricks. Villain bets €30 into €60. Your flush draw missed.
      </Text>
    </View>
  </Flip>
);
