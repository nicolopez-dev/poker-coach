import { GoldFrame, Text, Tilt, colors, radius, type } from 'poker-coach';

/**
 * `tilt3d` — an 8s loop of ±2° turns and a few pixels of drift, under reward cards.
 * `reverse` runs it backwards so two cards on one screen never move in step.
 */
export const RewardCard = () => (
  <Tilt>
    <GoldFrame radius={radius.hero} innerStyle={{ padding: 20 }}>
      <Text style={[type.kicker, { color: 'rgba(255,255,255,.6)', marginBottom: 8 }]}>Today</Text>
      <Text style={[type.heroTitle, { color: colors.textOnReward }]}>Pot odds on the river</Text>
    </GoldFrame>
  </Tilt>
);

export const Reversed = () => (
  <Tilt reverse>
    <GoldFrame radius={radius.hero} innerStyle={{ padding: 20 }}>
      <Text style={[type.kicker, { color: 'rgba(255,255,255,.6)', marginBottom: 8 }]}>Every player gets</Text>
      <Text style={[type.resultHeadline, { color: colors.textOnReward }]}>21 chips, worth 500 points</Text>
    </GoldFrame>
  </Tilt>
);
