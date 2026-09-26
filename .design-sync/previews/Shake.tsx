import { Shake, Suit, Text, View, colors, font, radius } from 'poker-coach';

/**
 * `shake` — ±7px, 400ms, on mount and whenever `replayKey` changes. It answers a wrong
 * answer: the picked row shakes, outlined in text colour, with a heart for the one spent.
 */
export const WrongAnswer = () => (
  <View style={{ gap: 8 }}>
    <Shake replayKey="q3-call">
      <View
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: radius.row,
          borderWidth: 1,
          borderColor: colors.text,
          backgroundColor: colors.surfaceInput,
          paddingHorizontal: 16,
        }}>
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, lineHeight: 17, color: colors.text }}>
          Call
        </Text>
        <Suit glyph="♥" size={16} color={colors.red} />
      </View>
    </Shake>
  </View>
);
