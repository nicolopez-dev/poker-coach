import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  goldGradient,
  goldGradientLocations,
  rewardCardFill,
  rewardCardFillLocations,
} from '../theme/tokens';
import { Tilt, useSheen } from './anim';

/** CSS gradient angles as react-native-linear-gradient start/end points. */
const angle = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  const x = Math.sin(rad) / 2;
  const y = -Math.cos(rad) / 2;
  return { start: { x: 0.5 - x, y: 0.5 - y }, end: { x: 0.5 + x, y: 0.5 + y } };
};

const GOLD_ANGLE = angle(115);
const FILL_ANGLE = angle(155);

/**
 * The "pro detail": a 1px border painted with the gold gradient.
 * The web original does it with a double background and `background-clip`;
 * here the gradient is a 1px frame around the surface.
 */
export function GoldFrame({
  children,
  radius,
  fill,
  style,
  innerStyle,
}: {
  children?: React.ReactNode;
  radius: number;
  /** solid surface colour; omit for the near-black reward-card gradient */
  fill?: string;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={goldGradient}
      locations={goldGradientLocations}
      start={GOLD_ANGLE.start}
      end={GOLD_ANGLE.end}
      style={[{ borderRadius: radius, padding: 1 }, style]}>
      {fill ? (
        <View style={[{ borderRadius: radius - 1, backgroundColor: fill }, innerStyle]}>
          {children}
        </View>
      ) : (
        <LinearGradient
          colors={rewardCardFill}
          locations={rewardCardFillLocations}
          start={FILL_ANGLE.start}
          end={FILL_ANGLE.end}
          style={[{ borderRadius: radius - 1, overflow: 'hidden' }, innerStyle]}>
          {children}
        </LinearGradient>
      )}
    </LinearGradient>
  );
}

/** `sheen` — a soft white glow drifting across a reward surface. */
export function Sheen({ delay = 0 }: { delay?: number }) {
  const t = useSheen(delay);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          pointerEvents: 'none',
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.26] }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [40, -40] }) },
          ],
        },
      ]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="sheen" cx="50%" cy="50%" rx="60%" ry="60%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <Stop offset="0.7" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheen)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * A reward surface: near-black gradient, 1px gold hairline, drifting sheen and
 * a slow 3D tilt. Used by the hero card and the chip result card.
 */
export function RewardCard({
  children,
  radius,
  style,
  innerStyle,
  reverse = false,
}: {
  children?: React.ReactNode;
  radius: number;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  /** the result card runs the tilt in reverse, so the two never sync up */
  reverse?: boolean;
}) {
  return (
    <Tilt style={style} reverse={reverse}>
      <GoldFrame radius={radius} innerStyle={innerStyle}>
        <Sheen />
        {children}
      </GoldFrame>
    </Tilt>
  );
}
