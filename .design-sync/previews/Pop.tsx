import { Pop, RewardButton, Suit, Text, View, colors, font, radius } from 'poker-coach';

const noop = () => {};

/**
 * `pop` — scale .92 → 1.02 → 1 with a fade, 350ms. The right answer pops: near-black,
 * gold hairline, white label, a gold spade.
 */
export const RightAnswer = () => (
  <Pop replayKey="q3-fold">
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: radius.row,
        borderWidth: 1,
        borderColor: colors.goldRule,
        backgroundColor: colors.reward,
        paddingHorizontal: 16,
      }}>
      <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, lineHeight: 17, color: colors.textOnReward }}>
        Fold
      </Text>
      <Suit glyph="♠" size={16} color={colors.gold} />
    </View>
  </Pop>
);

/** Out of hearts: the CTA pops in after the message rises. */
export const Cta = () => (
  <Pop delay={120}>
    <RewardButton label="Deal me in" glyph="♠" onPress={noop} glow />
  </Pop>
);
