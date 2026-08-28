/**
 * Design tokens for the v3 "felt" design.
 * Values come straight from docs/design-handoff/README.md — keep them in sync.
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  /** page behind the phone */
  ground: '#080d0a',

  /** felt gradient stops, outermost last */
  feltStops: ['#1d4433', '#12271d', '#0b1610'] as const,

  surface: '#16261e',
  surfaceDeep: '#0f1c15',
  surfaceInput: '#1e3228',
  surfaceInputAlt: '#12201a',
  surfaceLocked: '#15231c',
  surfaceMutedRow: '#13211a',
  track: '#22362b',

  hairline: 'rgba(240,239,233,.10)',
  hairlineStrong: 'rgba(240,239,233,.22)',
  hairlineFaint: 'rgba(240,239,233,.07)',

  text: '#f0efe9',
  textOnReward: '#ffffff',
  textSecondary: '#adc2b6',
  textMuted: '#8ea79a',
  textFaint: '#6d887a',

  cardFace: '#f4f1e6',
  cardInk: '#17181a',
  cardRed: '#b5121f',

  red: '#ff563c',
  /** carmesí — the fill of the one primary chip action, "Deal the stacks" */
  crimson: '#dc143c',
  crimsonPressed: '#b91032',
  redHover: '#ff7a63',
  redSoft: '#ff9783',
  redTint: '#4d2318',
  redTintDeep: '#33201a',
  redBorder: '#7a3324',
  redInk: '#f7e9e4',
  redBody: '#ffc4b8',

  green: '#57b183',
  greenLight: '#7fd6a5',
  greenDeep: '#1d4433',
  greenMid: '#2e6b4f',
  greenHover: '#2a5f47',
  greenSpent: '#2c4238',

  reward: '#08110d',
  rewardAlt: '#0b1210',
  rewardHover: '#141c19',

  gold: '#e8cf8a',
  goldRule: '#c9a75c',

  valueLocked: '#152219',
} as const;

/** Gradient stops, typed as expo-linear-gradient wants them. */
type Stops = readonly [string, string, ...string[]];
type Locations = readonly [number, number, ...number[]];

/** the 1px gradient border texture, 115deg */
export const goldGradient: Stops = ['#8a6a2f', '#f0dca0', '#c8a558', '#7d5f2a'];
export const goldGradientLocations: Locations = [0, 0.36, 0.62, 1];

/** near-black gradient fill used by the hero and result cards (155deg) */
export const rewardCardFill: Stops = ['#151a18', '#0d1211', '#080c0a'];
export const rewardCardFillLocations: Locations = [0, 0.6, 1];

/** RN 0.86 dropped `StyleSheet.absoluteFillObject` from its types. */
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

export const font = {
  regular: 'Archivo_400Regular',
  bold: 'Archivo_800ExtraBold',
} as const;

/** CSS `letter-spacing` is in em; React Native wants points. */
export const ls = (fontSize: number, em: number) => fontSize * em;

export const radius = {
  phone: 38,
  hero: 28,
  card: 26,
  smallCard: 22,
  row: 20,
  balanceRow: 18,
  loginInput: 16,
  input: 12,
  inputLarge: 14,
  pill: 999,
  tile: 8,
} as const;

export const spacing = {
  /** 66px top clears the translucent header */
  screen: { paddingTop: 66, paddingHorizontal: 18, paddingBottom: 26 },
  /** phones stay full width; tablets/desktop cap and centre */
  maxContentWidth: 480,
} as const;

/** The handoff's CSS shadows, verbatim — `boxShadow` takes the same syntax. */
export const shadows = {
  row: { boxShadow: '0 1px 2px rgba(0,0,0,.45)' },
  chip: { boxShadow: '0 1px 3px rgba(0,0,0,.55)' },
  chipLarge: { boxShadow: '0 2px 4px rgba(0,0,0,.55)' },
  card: { boxShadow: '0 3px 8px rgba(0,0,0,.45)' },
  big: { boxShadow: '0 16px 30px rgba(0,0,0,.4)' },
  dealerButton: { boxShadow: '0 2px 5px rgba(0,0,0,.5)' },
  playingCard: { boxShadow: '0 2px 8px rgba(0,0,0,.5)' },
} satisfies Record<string, ViewStyle>;

/** Minimum touch target across the app. */
export const TOUCH = 44;

export const type = {
  screenTitle: {
    fontFamily: font.bold,
    fontSize: 27,
    lineHeight: 27 * 1.03,
    letterSpacing: ls(27, -0.025),
    color: colors.text,
  } as TextStyle,
  heroTitle: {
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 30 * 1.03,
    letterSpacing: ls(30, -0.025),
    color: colors.textOnReward,
  } as TextStyle,
  resultHeadline: {
    fontFamily: font.bold,
    fontSize: 24,
    lineHeight: 24 * 1.05,
    letterSpacing: ls(24, -0.02),
    color: colors.textOnReward,
  } as TextStyle,
  sectionHeading: {
    fontFamily: font.bold,
    fontSize: 22,
    lineHeight: 22 * 1.05,
    letterSpacing: ls(22, -0.02),
    color: colors.text,
  } as TextStyle,
  bigNumber: {
    fontFamily: font.bold,
    fontSize: 46,
    lineHeight: 46 * 0.98,
    letterSpacing: ls(46, -0.035),
    color: colors.text,
  } as TextStyle,
  statNumber: { fontFamily: font.bold, fontSize: 24, lineHeight: 24, color: colors.text } as TextStyle,
  rowTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 17 * 1.15,
    color: colors.text,
  } as TextStyle,
  body: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    color: colors.textSecondary,
  } as TextStyle,
  bodySmall: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.4,
    color: colors.textMuted,
  } as TextStyle,
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
  } as TextStyle,
  micro: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 9,
    letterSpacing: ls(9, 0.08),
    textTransform: 'uppercase',
    color: colors.textMuted,
  } as TextStyle,
  buttonLabel: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 15,
    color: colors.textOnReward,
  } as TextStyle,
} as const;

/**
 * `backdrop-filter` has no native equivalent on Android; expo-blur only blurs
 * what is behind it on iOS and web. Elsewhere we lean on a slightly more opaque
 * fill so the header still separates from the content scrolling under it.
 */
export const headerFill =
  Platform.OS === 'android' ? 'rgba(10,20,15,.92)' : 'rgba(10,20,15,.58)';
