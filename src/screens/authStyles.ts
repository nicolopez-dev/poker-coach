import { StyleSheet } from 'react-native';

import { colors, font, ls, spacing } from '../theme/tokens';

/**
 * The shell every auth screen shares: felt overlay, centred column, the 30px title and
 * the 13px line under it. Values come from the login screen, which is the one measured
 * against `docs/design-handoff/screens/01-login.png` — it keeps its own copy so the
 * handoff reference stays readable in one file, and these must not drift from it.
 */
export const authStyles = StyleSheet.create({
  overlay: { zIndex: 30, overflow: 'hidden', backgroundColor: colors.ground },
  center: { flex: 1, justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 22 },
  column: { width: '100%', maxWidth: spacing.maxContentWidth, alignSelf: 'center' },
  brand: { marginBottom: 26 },
  title: {
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 30 * 1.03,
    letterSpacing: ls(30, -0.03),
    color: colors.textOnReward,
    marginBottom: 6,
  },
  sub: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    color: colors.textMuted,
    marginBottom: 22,
  },
  /** Said before the rule can be broken, rather than after. */
  hint: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13 * 1.25,
    color: colors.textFaint,
    paddingHorizontal: 2,
  },
  /**
   * Red is reserved for the chip action, hearts, the "Playing" badge and chip focus
   * rings — and for telling someone a form failed, which is the one other place the app
   * has to be unmissable.
   */
  error: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13 * 1.25,
    color: colors.red,
    paddingHorizontal: 2,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 22 },
  back: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    paddingVertical: 8,
  },
});
