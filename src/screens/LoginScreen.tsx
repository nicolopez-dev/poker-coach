import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AceCard } from '../components/AceCard';
import { Rise } from '../components/anim';
import { Felt } from '../components/Felt';
import { GoogleIcon } from '../components/icons';
import { Brand, RewardButton } from '../components/ui';
import { useStore } from '../state/store';
import { colors, font, ls, radius, spacing } from '../theme/tokens';

/**
 * The auth gate. Every button authenticates for now — email/password and real
 * Google OAuth are still to be wired up (see "Open items" in the handoff).
 */
export function LoginScreen() {
  const { email, pass, setEmail, setPass, signIn } = useStore();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState<'email' | 'pass' | null>(null);

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Felt />
      <AceCard
        width={200}
        opacity={0.22}
        rotate={13}
        style={{ position: 'absolute', top: -24, right: -58 }}
      />
      <AceCard
        width={190}
        opacity={0.14}
        rotate={-11}
        style={{ position: 'absolute', bottom: -70, left: -64 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}>
        <Rise style={[styles.column, { paddingTop: insets.top }]}>
          <View style={styles.brand}>
            <Brand />
          </View>

          <Text style={styles.title}>Take a seat</Text>
          <Text style={styles.sub}>Your streak, your units, your chip case — all waiting.</Text>

          <View style={{ gap: 9 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@table.com"
              placeholderTextColor={colors.textFaint}
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              selectionColor={colors.gold}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              style={[styles.input, focused === 'email' && styles.inputFocused]}
            />
            <TextInput
              value={pass}
              onChangeText={setPass}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoComplete="current-password"
              selectionColor={colors.gold}
              onFocus={() => setFocused('pass')}
              onBlur={() => setFocused(null)}
              style={[styles.input, focused === 'pass' && styles.inputFocused]}
            />
            <RewardButton
              label="Log in"
              glyph="♠"
              glyphColor={colors.gold}
              height={54}
              circleSize={36}
              onPress={signIn}
              style={{ marginTop: 5 }}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={styles.or}>or</Text>
            <View style={styles.rule} />
          </View>

          <Pressable onPress={signIn} accessibilityRole="button" style={styles.google}>
            <GoogleIcon />
            <Text style={styles.googleLabel}>Continue with Google</Text>
          </Pressable>

          <View style={styles.footer}>
            <Pressable onPress={signIn} accessibilityRole="button">
              <Text style={styles.create}>Create an account</Text>
            </Pressable>
            <Pressable onPress={signIn} accessibilityRole="button">
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
          </View>
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  input: {
    minHeight: 50,
    borderRadius: radius.loginInput,
    borderWidth: 1,
    borderColor: 'rgba(240,239,233,.14)',
    backgroundColor: colors.surfaceInputAlt,
    paddingVertical: 6,
    paddingHorizontal: 15,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.goldRule },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  rule: { flex: 1, height: 1, backgroundColor: 'rgba(240,239,233,.14)' },
  or: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.14),
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  google: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    backgroundColor: colors.cardFace,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
  },
  googleLabel: { fontFamily: font.bold, fontSize: 14, lineHeight: 16, color: colors.cardInk },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 22,
  },
  create: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    paddingVertical: 8,
  },
  forgot: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textFaint,
    paddingVertical: 8,
  },
});
