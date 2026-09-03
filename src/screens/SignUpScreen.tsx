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

import { useAuth } from '../auth/AuthProvider';
import { PASSWORD_RULE, passwordProblem, strength } from '../auth/password';
import { AceCard } from '../components/AceCard';
import { Rise } from '../components/anim';
import { Felt } from '../components/Felt';
import { AuthField, Brand, RewardButton } from '../components/ui';
import { authStyles } from './authStyles';
import { colors } from '../theme/tokens';

/** Same loose test the login screen uses: catch "not an address", nothing more. */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOT_AN_EMAIL = "That doesn't look like an email address.";
const NO_MATCH = "Those two passwords aren't the same.";

/**
 * Sign-up. The confirmation email is a soft gate (§1): a session comes back, the app
 * opens, and the banner nags until the address is confirmed.
 */
export function SignUpScreen() {
  const { signUp, goTo } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const passwordField = useRef<TextInput>(null);
  const confirmField = useRef<TextInput>(null);

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (error) setError(null);
  };

  async function submit() {
    if (submitting) return;

    const address = email.trim().toLowerCase();
    if (!PLAUSIBLE_EMAIL.test(address)) return setError(NOT_AN_EMAIL);
    // the server's whole rule, checked here, so it is never news after a round trip
    const weak = passwordProblem(pass);
    if (weak) return setError(weak);
    if (pass !== confirm) return setError(NO_MATCH);

    setError(null);
    setSubmitting(true);
    const outcome = await signUp(address, pass);

    if (!outcome.ok) {
      setError(outcome.message);
      setSubmitting(false);
      return;
    }

    if (outcome.state === 'signedIn') {
      // straight on to picking a name and an avatar; the banner takes it from there
      return goTo('profileSetup');
    }
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
            <Sent email={email.trim().toLowerCase()} onBack={() => goTo('login')} />
          ) : (
            <>
              <Text style={authStyles.title}>Pull up a chair</Text>
              <Text style={authStyles.sub}>
                An address, a password worth keeping, and your streak starts tonight.
              </Text>

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
                  autoComplete="new-password"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmField.current?.focus()}
                />
                {/* the rule, said before it can be broken rather than after */}
                <Text style={authStyles.hint}>
                  {PASSWORD_RULE}
                  {strength(pass) ? ` ${strength(pass)}` : ''}
                </Text>
                <AuthField
                  ref={confirmField}
                  value={confirm}
                  onChangeText={edit(setConfirm)}
                  placeholder="Confirm password"
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                {error && (
                  <Text style={authStyles.error} accessibilityRole="alert">
                    {error}
                  </Text>
                )}
                <RewardButton
                  label={submitting ? 'Dealing…' : 'Create account'}
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
                  <Text style={authStyles.back}>Already have an account?</Text>
                </Pressable>
              </View>
            </>
          )}
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Shown whether the address was free or already taken. The copy must not narrow that
 * down: "we sent you something" is true either way, and anything more specific turns
 * this screen into a way to test which addresses have accounts (§3 rule 7).
 */
function Sent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <>
      <Text style={authStyles.title}>Check your inbox</Text>
      <Text style={authStyles.sub}>
        If that address can take a seat, there is a link waiting at {email}. Open it to
        confirm and you are in.
      </Text>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={authStyles.back}>Back to log in</Text>
      </Pressable>
    </>
  );
}
