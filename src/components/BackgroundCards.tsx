import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AceCard } from './AceCard';

/** Scroll multipliers: the near card drifts slowly, the far card faster. */
const NEAR = 0.12;
const FAR = 0.42;

/** The two aces drifting behind a tab's content. */
export function BackgroundCards({ scrollY }: { scrollY: Animated.Value }) {
  const drift = (factor: number) =>
    scrollY.interpolate({
      inputRange: [0, 1000],
      outputRange: [0, -1000 * factor],
      extrapolate: 'extend',
    });

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      <AceCard
        width={230}
        opacity={0.34}
        rotate={-9}
        translateY={drift(NEAR)}
        style={{ position: 'absolute', top: 120, left: -40 }}
      />
      <AceCard
        width={190}
        opacity={0.16}
        rotate={13}
        translateY={drift(FAR)}
        style={{ position: 'absolute', top: 560, right: -56 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { overflow: 'hidden', zIndex: 0, pointerEvents: 'none' },
});
