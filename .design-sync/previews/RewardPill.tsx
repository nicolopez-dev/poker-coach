import { GoldFrame, RewardPill, View, radius } from 'poker-coach';

/** RewardPill is translucent white: it only reads on a reward surface, so it sits on one. */
const Surface = ({ children }: { children: React.ReactNode }) => (
  <GoldFrame radius={radius.card} innerStyle={{ padding: 16 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
  </GoldFrame>
);

/** The result card's summary row. */
export const ResultSummary = () => (
  <Surface>
    <RewardPill value={500} label="per player" />
    <RewardPill value={126} label="dealt" />
    <RewardPill value={74} label="in bank" />
  </Surface>
);

export const Single = () => (
  <Surface>
    <RewardPill value="+40" label="xp" />
  </Surface>
);
