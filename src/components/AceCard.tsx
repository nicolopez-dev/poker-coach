import React from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

import { colors, font } from '../theme/tokens';

const VB_W = 120;
const VB_H = 170;

/**
 * The gold-stroke ace that drifts behind every screen. Line art only: outer
 * rounded rect, inner frame, corner index and one big centred pip.
 * Stroke width is pre-divided so the 1.1px hairline survives the scale-up.
 */
export function AceCard({
  suit = '♠',
  width,
  opacity,
  rotate,
  translateY,
  style,
}: {
  suit?: string;
  width: number;
  opacity: number;
  /** degrees */
  rotate: number;
  translateY?: Animated.AnimatedInterpolation<number> | number;
  style?: StyleProp<ViewStyle>;
}) {
  const height = (width * VB_H) / VB_W;
  const strokeWidth = 1.1 * (VB_W / width);

  return (
    <Animated.View
      style={[
        { width, height, opacity, pointerEvents: 'none' },
        { transform: [{ rotate: `${rotate}deg` }, { translateY: translateY ?? 0 }] },
        style,
      ]}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <G fill="none" stroke={colors.gold} strokeWidth={strokeWidth}>
          <Rect x={2} y={2} width={116} height={166} rx={9} />
          <Rect x={26} y={14} width={68} height={142} />
        </G>
        <SvgText x={9} y={25} fontFamily={font.bold} fontSize={18} fill={colors.gold}>
          A
        </SvgText>
        <SvgText x={9} y={42} fontFamily={font.regular} fontSize={15} fill={colors.gold}>
          {suit}
        </SvgText>
        <SvgText
          x={60}
          y={103}
          textAnchor="middle"
          fontFamily={font.regular}
          fontSize={72}
          fill="rgba(232,207,160,.55)">
          {suit}
        </SvgText>
      </Svg>
    </Animated.View>
  );
}
