import { GoldFrame, Sheen, Text, colors, radius, type } from 'poker-coach';

/**
 * Sheen fills its parent absolutely and drifts a soft white glow across it. It only
 * belongs on a reward surface: first child, under the content.
 */
export const OnRewardSurface = () => (
  <GoldFrame
    radius={radius.hero}
    innerStyle={{ padding: 20, minHeight: 140, overflow: 'hidden', justifyContent: 'flex-end' }}>
    <Sheen />
    <Text style={[type.kicker, { color: 'rgba(255,255,255,.6)', marginBottom: 8 }]}>Rank up</Text>
    <Text style={[type.resultHeadline, { color: colors.textOnReward }]}>You’re a Regular now</Text>
  </GoldFrame>
);
