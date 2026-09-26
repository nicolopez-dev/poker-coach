import { Animated, BackgroundCards, Text, View, type } from 'poker-coach';

const scrollY = new Animated.Value(0);

/**
 * The two aces behind a tab: fills its parent absolutely and drifts with `scrollY` at
 * two speeds. Content goes after it; it never takes a touch.
 */
export const BehindATab = () => (
  <View style={{ height: 740, overflow: 'hidden', paddingTop: 66, paddingHorizontal: 18 }}>
    <BackgroundCards scrollY={scrollY} />
    <Text style={[type.kicker, { marginBottom: 8 }]}>Chapter 3</Text>
    <Text style={type.screenTitle}>Your path</Text>
  </View>
);
