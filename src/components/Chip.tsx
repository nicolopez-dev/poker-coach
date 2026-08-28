import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { chipDash, chipInk, isLightChip } from '../lib/color';
import { font, shadows } from '../theme/tokens';

/** Edge dashes: 8° of dash every 30°, from 12 o'clock. */
const DASH_ARC = 8;
const DASH_STEP = 30;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
};

const wedge = (cx: number, cy: number, r: number, from: number, to: number) => {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y} Z`;
};

/**
 * The canonical chip: dashed edge, inset face, value printed on the face.
 * Used in the result card and in the Balance stacks.
 */
export function Chip({
  size,
  swatch,
  value,
  style,
}: {
  size: number;
  swatch: string;
  /** printed on the face; omit for a blank chip */
  value?: number;
  style?: ViewStyle;
}) {
  const r = size / 2;
  const faceRadius = r - 4;
  const dash = chipDash(swatch);
  const ink = chipInk(swatch);
  const light = isLightChip(swatch);

  const dashes: string[] = [];
  for (let a = 0; a < 360; a += DASH_STEP) {
    dashes.push(wedge(r, r, r, a, a + DASH_ARC));
  }

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: r, backgroundColor: swatch },
        size >= 32 ? shadows.chipLarge : shadows.chip,
        style,
      ]}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r} fill={swatch} />
        {dashes.map((d, i) => (
          <Path key={i} d={d} fill={dash} />
        ))}
        <Circle
          cx={r}
          cy={r}
          r={faceRadius}
          fill={swatch}
          stroke="rgba(255,255,255,.42)"
          strokeWidth={1}
        />
      </Svg>
      {value !== undefined && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'center',
              textAlignVertical: 'center',
              lineHeight: size,
              fontFamily: font.bold,
              fontSize: size >= 32 ? 10 : 9,
              color: ink,
              ...(light
                ? null
                : {
                    textShadowColor: 'rgba(0,0,0,.75)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }),
            }}>
            {value}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The chips stacked under the top chip in the Balance graphic. */
export function ChipEdge({ swatch }: { swatch: string }) {
  return (
    <View
      style={{
        width: 26,
        height: 5,
        borderRadius: 3,
        backgroundColor: swatch,
        borderBottomWidth: 1.5,
        borderBottomColor: 'rgba(0,0,0,.4)',
      }}
    />
  );
}
