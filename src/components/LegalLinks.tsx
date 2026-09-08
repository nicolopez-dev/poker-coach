import * as Linking from 'expo-linking';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, font, ls } from '../theme/tokens';
import { pressable } from './ui';

/**
 * The two pages both stores require before they will take a build, served from the
 * marketing site (docs/environments.md — Vercel holds `pokercoach.app`, and only that).
 * Absolute rather than derived from the Supabase URL: the site and the backend are
 * different things in different places, and a staging build should still link to the
 * policy people can actually read.
 */
export const PRIVACY_URL = 'https://pokercoach.app/privacy';
export const TERMS_URL = 'https://pokercoach.app/terms';

/**
 * The legal footer, on the login screen and at the bottom of You. Deliberately the
 * quietest thing on either screen — it has to be reachable, not read.
 */
export function LegalLinks({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <Link label="Privacy policy" url={PRIVACY_URL} />
      <Text style={styles.dot}>·</Text>
      <Link label="Terms" url={TERMS_URL} />
    </View>
  );
}

function Link({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      // a device with no browser to open it is not worth an unhandled rejection
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      accessibilityRole="link"
      style={pressable()}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.02),
    color: colors.textFaint,
    paddingVertical: 8,
  },
  dot: { fontFamily: font.regular, fontSize: 11, lineHeight: 13, color: colors.textFaint },
});
