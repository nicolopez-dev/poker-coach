import React, { useRef, useState } from 'react';
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

import { signInWithGoogle } from '../auth/google';
import { AceCard } from '../components/AceCard';
import { Rise } from '../components/anim';
import { Felt } from '../components/Felt';
import { GoogleIcon } from '../components/icons';
import { AuthField, Brand, RewardButton } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { colors, font, ls, radius, spacing } from '../theme/tokens';

/**
 * Loose on purpose. Catching "not an address at all" saves a round trip and a pointless
 * failure; deciding whether an address is deliverable is the confirmation email's job.
 */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Said before the network is touched — neither reveals anything about an account. */
const NOT_AN_EMAIL = "That doesn't look like an email address.";
const NO_PASSWORD = 'Enter your password.';

/** The auth gate. */
export function LoginScreen() {
  const { signInWithPassword, goTo } = useAuth();
  const insets = useSafeAreaInsets();
  // form state belongs to the form, not to the store
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [google, setGoogle] = useState(false);
  const passwordField = useRef<TextInput>(null);

  const busy = submitting || google;

  /** Any edit clears the error: a stale complaint about the last attempt is noise. */
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (error) setError(null);
  };

  async function submit() {
    if (submitting) return;

    const address = email.trim().toLowerCase();
    if (!PLAUSIBLE_EMAIL.test(address)) return setError(NOT_AN_EMAIL);
    if (!pass) return setError(NO_PASSWORD);

    setError(null);
    setSubmitting(true);
    const outcome = await signInWithPassword(address, pass);
    // on success the session lands and this screen unmounts, so only failure is handled
    if (!outcome.ok) {
      setError(outcome.message);
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    if (busy) return;

    setError(null);
    setGoogle(true);
    const outcome = await signInWithGoogle();

    // Closing Google's sheet is a decision, not a failure: say nothing, change nothing,
    // and leave the form exactly as they left it.
    if (!outcome.ok && !outcome.cancelled) setError(outcome.message);
    setGoogle(false);
  }

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
            <AuthField
              value={email}
              onChangeText={edit(setEmail)}
              placeholder="you@table.com"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordField.current?.focus()}
            />
            <AuthField
              ref={passwordField}
              value={pass}
              onChangeText={edit(setPass)}
              placeholder="Password"
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
            <RewardButton
              label={submitting ? 'Dealing…' : 'Log in'}
              glyph="♠"
              glyphColor={colors.gold}
              height={54}
              circleSize={36}
              disabled={busy}
              onPress={submit}
              style={{ marginTop: 5 }}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={styles.or}>or</Text>
            <View style={styles.rule} />
          </View>

          <Pressable
            onPress={continueWithGoogle}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy: google }}
            // the pill itself is exactly as designed; only its opacity moves
            style={({ pressed }) => [
              styles.google,
              pressed && styles.googlePressed,
              google && styles.googleBusy,
            ]}>
            <GoogleIcon />
            <Text style={styles.googleLabel}>
              {google ? 'Talking to Google…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Pressable onPress={() => goTo('signUp')} accessibilityRole="button">
              <Text style={styles.create}>Create an account</Text>
            </Pressable>
            <Pressable onPress={() => goTo('forgot')} accessibilityRole="button">
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
  /**
   * Red is reserved for the chip action, hearts, the "Playing" badge and chip focus
   * rings — and for telling someone their login failed, which is the one other place
   * the app needs to be unmissable. 11px, the muted scale the footer links use.
   */
  error: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13 * 1.25,
    color: colors.red,
    paddingHorizontal: 2,
  },
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
  /** The same 0.98 press the other buttons use, via `pressable()`'s scale. */
  googlePressed: { transform: [{ scale: 0.98 }] },
  googleBusy: { opacity: 0.55 },
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
