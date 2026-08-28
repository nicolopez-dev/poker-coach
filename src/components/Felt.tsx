import React, { useId } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * The felt: a radial gradient lit from just above the top edge, with a woven
 * cloth overlay of 1px lines on a 3px pitch.
 */
export function Felt({ style }: { style?: ViewStyle }) {
  const id = useId().replace(/:/g, '');
  const gradient = `felt-${id}`;
  const weave = `weave-${id}`;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ground }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradient} cx="50%" cy="-5%" rx="130%" ry="85%">
            <Stop offset="0" stopColor={colors.feltStops[0]} />
            <Stop offset="0.45" stopColor={colors.feltStops[1]} />
            <Stop offset="1" stopColor={colors.feltStops[2]} />
          </RadialGradient>
          <Pattern id={weave} patternUnits="userSpaceOnUse" width="3" height="3">
            <Rect x="0" y="0" width="3" height="1" fill="rgba(240,239,233,.022)" />
            <Rect x="0" y="0" width="1" height="3" fill="rgba(0,0,0,.055)" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradient})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${weave})`} />
      </Svg>
    </View>
  );
}
