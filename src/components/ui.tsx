import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { colors, font, ls, radius, shadows, TOUCH } from '../theme/tokens';
import { Glow } from './anim';
import { GoldFrame } from './Gold';
import { MAX_HEARTS } from '../state/store';

/**
 * Suit pips render in the platform font: Archivo ships no card glyphs, and a
 * missing glyph in a named family shows as tofu on Android.
 */
export function Suit({
  glyph,
  size,
  color,
  bold = true,
  style,
}: {
  glyph: string;
  size: number;
  color: string;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        { fontSize: size, lineHeight: size * 1.15, color, fontWeight: bold ? '800' : '400' },
        style,
      ]}>
      {glyph}
    </Text>
  );
}

/** The ♠ mark plus wordmark, used in the header and on the login screen. */
export function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={styles.brandMark}>
        <Suit glyph="♠" size={15} color={colors.text} />
      </View>
      <Text style={styles.brandWord}>Poker Coach</Text>
    </View>
  );
}

export function HeartsPill({ hearts }: { hearts: number }) {
  return (
    <View style={styles.heartsPill}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <Suit
          key={i}
          glyph="♥"
          size={11}
          color={i < hearts ? colors.red : colors.greenSpent}
        />
      ))}
    </View>
  );
}

export function StreakPill({ streak }: { streak: number }) {
  return (
    <GoldFrame radius={radius.pill} fill={colors.rewardAlt}>
      <View style={styles.streakPill}>
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakLabel}>day</Text>
      </View>
    </GoldFrame>
  );
}

export function ProgressBar({
  pct,
  height = 8,
  track = colors.track,
  fill = colors.green,
  style,
}: {
  pct: number;
  height?: number;
  track?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { height, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' },
        style,
      ]}>
      <View
        style={{
          height,
          borderRadius: radius.pill,
          backgroundColor: fill,
          width: `${Math.max(0, Math.min(100, pct))}%`,
        }}
      />
    </View>
  );
}

/** A stat pill: big number, small uppercase label. */
export function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

/** A translucent pill on a reward surface: "{n} per player" and friends. */
export function RewardPill({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.rewardPill}>
      <Text style={styles.rewardPillValue}>{value} </Text>
      <Text style={styles.rewardPillLabel}>{label}</Text>
    </View>
  );
}

/**
 * The reward button: near-black fill, 1px gold hairline, white label and a
 * trailing suit in a soft circle. Used for the drill CTA, log in, back to today.
 */
export function RewardButton({
  label,
  glyph,
  onPress,
  height = 58,
  circleSize = 38,
  glow = false,
  glyphColor = colors.textOnReward,
  style,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  height?: number;
  circleSize?: number;
  glow?: boolean;
  glyphColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const button = (
    <Pressable onPress={onPress} accessibilityRole="button" style={pressable()}>
      <GoldFrame radius={radius.pill} fill={colors.rewardAlt}>
        <View style={[styles.ctaInner, { minHeight: height - 2 }]}>
          <Text style={styles.ctaLabel}>{label}</Text>
          <View
            style={[
              styles.ctaCircle,
              { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
            ]}>
            <Suit glyph={glyph} size={circleSize >= 38 ? 16 : 14} color={glyphColor} />
          </View>
        </View>
      </GoldFrame>
    </Pressable>
  );

  return glow ? <Glow style={style}>{button}</Glow> : <View style={style}>{button}</View>;
}

/** The one primary chip action, in carmesí. Red is reserved for this and hearts. */
export function RedButton({
  label,
  glyph,
  onPress,
  style,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={pressable([styles.redButton, style])}>
      <Text style={styles.redButtonLabel}>{label}</Text>
      <View style={styles.redButtonCircle}>
        <Suit glyph={glyph} size={15} color={colors.redInk} />
      </View>
    </Pressable>
  );
}

/** Outline pill — "Your games", "Reuse". */
export function OutlineButton({
  label,
  glyph,
  onPress,
  active = false,
  height = 52,
  style,
}: {
  label: string;
  glyph?: string;
  onPress: () => void;
  active?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.outlineButton,
        {
          minHeight: height,
          borderColor: active ? colors.goldRule : colors.hairlineStrong,
          justifyContent: glyph ? 'space-between' : 'center',
        },
        style,
      ]}>
      <Text style={[styles.outlineLabel, active && { color: colors.gold }]}>{label}</Text>
      {glyph ? (
        <Suit glyph={glyph} size={15} color={active ? colors.gold : colors.text} />
      ) : null}
    </Pressable>
  );
}

/** Numeric field used across the chip tool and Balance rows. */
export function NumberField({
  value,
  onChangeText,
  width,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { width?: number }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      inputMode="numeric"
      keyboardType="number-pad"
      selectionColor={colors.red}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.numberField,
        width ? { width } : null,
        focused && { borderColor: colors.red },
        style,
      ]}
      {...rest}
    />
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.hairline }, style]} />;
}

/** Buttons dip slightly when pressed — `transform .12s ease`, `scale(.98)`. */
export const pressable =
  (base?: StyleProp<ViewStyle>, scale = 0.98) =>
  ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> =>
    pressed ? [base, { transform: [{ scale }] }] : base;

const styles = StyleSheet.create({
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.greenDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWord: {
    fontFamily: font.bold,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: ls(14, -0.01),
    color: colors.text,
  },
  heartsPill: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 9,
    alignItems: 'center',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  streakNumber: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, color: colors.gold },
  streakLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.7)',
  },
  statPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInput,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statPillValue: { fontFamily: font.bold, fontSize: 15, lineHeight: 17, color: colors.text },
  statPillLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  rewardPill: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(240,239,233,.12)',
    paddingVertical: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rewardPillValue: {
    fontFamily: font.bold,
    fontSize: 12,
    lineHeight: 14,
    color: colors.textOnReward,
  },
  rewardPillLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: 'rgba(240,239,233,.7)',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingLeft: 20,
    paddingRight: 12,
    borderRadius: radius.pill,
  },
  ctaLabel: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: ls(15, 0.02),
    color: colors.textOnReward,
  },
  ctaCircle: {
    backgroundColor: 'rgba(240,239,233,.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.crimson,
    borderRadius: radius.pill,
    paddingLeft: 20,
    paddingRight: 12,
  },
  redButtonLabel: { fontFamily: font.bold, fontSize: 15, lineHeight: 18, color: colors.redInk },
  redButtonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingLeft: 18,
    paddingRight: 12,
  },
  outlineLabel: {
    fontFamily: font.bold,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: ls(12, 0.04),
    textTransform: 'uppercase',
    color: colors.text,
  },
  numberField: {
    minHeight: 36,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceInput,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: font.bold,
    fontSize: 14,
    textAlign: 'center',
    color: colors.text,
  },
});

export { shadows, TOUCH };
