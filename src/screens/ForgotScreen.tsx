import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { AceCard } from '../components/AceCard';
import { Rise } from '../components/anim';
import { Felt } from '../components/Felt';
import { AuthField, Brand, RewardButton } from '../components/ui';
import { authStyles } from './authStyles';
import { colors } from '../theme/tokens';

const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_AN_EMAIL = "That doesn't look like an email address.";

/**
 * Password reset, step one.
 *
 * The confirmation below is shown whatever happens — a real account, no account, even a
 * send that failed. §3 rule 7: same copy, same timing, or this screen becomes a way to
 * find out which addresses are registered.
 */
export function ForgotScreen() {
  const { sendPasswordReset, goTo } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (submitting) return;

    const address = email.trim().toLowerCase();
    // the only thing worth saying no to here: a string that cannot be an address at all
    if (!PLAUSIBLE_EMAIL.test(address)) return setError(NOT_AN_EMAIL);

    setError(null);
    setSubmitting(true);
    await sendPasswordReset(address);
    // deliberately not branching on the result
    setSubmitting(false);
    setSent(true);
  }

  return (
    <View style={[StyleSheet.absoluteFill, authStyles.overlay]}>
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
        style={authStyles.center}>
        <Rise style={[authStyles.column, { paddingTop: insets.top }]}>
          <View style={authStyles.brand}>
            <Brand />
          </View>

          {sent ? (
            <>
              <Text style={authStyles.title}>Check your inbox</Text>
              <Text style={authStyles.sub}>
                If that address has an account, a link is on its way. It is good for an hour.
              </Text>
              <Pressable onPress={() => goTo('login')} accessibilityRole="button">
                <Text style={authStyles.back}>Back to log in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={authStyles.title}>Lost your password</Text>
              <Text style={authStyles.sub}>
                Tell us the address you play under and we will send a way back in.
              </Text>

              <View style={{ gap: 9 }}>
                <AuthField
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) setError(null);
                  }}
                  placeholder="you@table.com"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                {error && (
                  <Text style={authStyles.error} accessibilityRole="alert">
                    {error}
                  </Text>
                )}
                <RewardButton
                  label={submitting ? 'Dealing…' : 'Send the link'}
                  glyph="♠"
                  glyphColor={colors.gold}
                  height={54}
                  circleSize={36}
                  disabled={submitting}
                  onPress={submit}
                  style={{ marginTop: 5 }}
                />
              </View>

              <View style={authStyles.footer}>
                <Pressable onPress={() => goTo('login')} accessibilityRole="button">
                  <Text style={authStyles.back}>Back to log in</Text>
                </Pressable>
              </View>
            </>
          )}
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}
