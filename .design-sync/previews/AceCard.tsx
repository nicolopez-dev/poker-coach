import { AceCard, View } from 'poker-coach';

/** The gold line-art ace, upright and at full strength. */
export const Upright = () => (
  <View style={{ flexDirection: 'row', gap: 20, paddingVertical: 8 }}>
    <AceCard width={120} opacity={1} rotate={0} />
    <AceCard suit="♥" width={120} opacity={1} rotate={0} />
  </View>
);

/** As it sits behind a screen: tilted, and faded right back. */
export const Drifting = () => (
  <View style={{ height: 250, flexDirection: 'row', alignItems: 'center', gap: 28, paddingLeft: 12 }}>
    <AceCard width={150} opacity={0.34} rotate={-9} />
    <AceCard width={120} opacity={0.16} rotate={13} />
  </View>
);
