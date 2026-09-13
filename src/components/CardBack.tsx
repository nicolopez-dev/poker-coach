import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * The back of a face-down card: the handoff's
 * `repeating-linear-gradient(45deg,#2e6b4f 0 5px,#1d4433 5px 10px)`.
 *
 * React Native has no repeating gradient, so the stripes are an SVG pattern — which
 * tiles at a fixed size the way the CSS does, rather than stretching with the card the
 * way a stop-based approximation would.
 */
export function CardBack({
  radius = 8,
  style,
}: {
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          {/* one 45° tile: 10px across, half of it the lighter green */}
          <Pattern
            id="cardback"
            patternUnits="userSpaceOnUse"
            width={10}
            height={10}
            patternTransform="rotate(45)">
            <Rect width={10} height={10} fill={colors.greenDeep} />
            <Line x1={2.5} y1={0} x2={2.5} y2={10} stroke={colors.greenMid} strokeWidth={5} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#cardback)" />
      </Svg>
    </View>
  );
}
