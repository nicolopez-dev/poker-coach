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
import { GENERIC } from '../auth/errors';
import { AceCard } from '../components/AceCard';
import { Rise } from '../components/anim';
import { Felt } from '../components/Felt';
import { AuthField, Brand, RewardButton } from '../components/ui';
import { authStyles } from './authStyles';
import { PASSWORD_RULE, passwordProblem } from '../auth/password';
import { colors, font } from '../theme/tokens';

const NO_MATCH = "Those two passwords aren't the same.";

/**
 * Password reset, step two: reached by a recovery link, which signs the caller in
 * before they have chosen anything. That is why this renders *over* a signed-in app
 * (see `authScreenShowing`) rather than instead of it.
 */
export function ResetScreen() {
  const { updatePassword, signOut, goTo, linkError } = useAuth();
  const insets = useSafeAreaInsets();

  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmField = useRef<TextInput>(null);

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (error) setError(null);
  };

  async function submit() {
    if (submitting) return;
    const weak = passwordProblem(pass);
    if (weak) return setError(weak);
    if (pass !== confirm) return setError(NO_MATCH);

    setError(null);
    setSubmitting(true);

    const outcome = await updatePassword(pass);
    if (!outcome.ok) {
      setError(outcome.message);
      setSubmitting(false);
      return;
    }

    // A reset exists because the old password may be in someone else's hands. Ending
    // every other session is the point of the exercise — `others` leaves this device
    // signed in, so the player lands in the app rather than back at the login screen.
    await signOut('others');
    goTo('login');
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

          {linkError ? (
            <Expired reason={linkError} onRetry={() => goTo('forgot')} />
          ) : (
            <>
              <Text style={authStyles.title}>Choose a new one</Text>
              <Text style={authStyles.sub}>
                Set it here and every other device is signed out.
              </Text>

              <View style={{ gap: 9 }}>
                <AuthField
                  value={pass}
                  onChangeText={edit(setPass)}
                  placeholder="New password"
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmField.current?.focus()}
                />
                <Text style={authStyles.hint}>{PASSWORD_RULE}</Text>
                <AuthField
                  ref={confirmField}
                  value={confirm}
                  onChangeText={edit(setConfirm)}
                  placeholder="Confirm new password"
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
                  label={submitting ? 'Dealing…' : 'Set password'}
                  glyph="♠"
                  glyphColor={colors.gold}
                  height={54}
                  circleSize={36}
                  disabled={submitting}
                  onPress={submit}
                  style={{ marginTop: 5 }}
                />
              </View>
            </>
          )}
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * A dead link. Reset links are one-shot and short-lived, so this is the ordinary
 * outcome of opening yesterday's email, not an error — it needs a way onwards, which a
 * blank screen or a form that cannot succeed would not give.
 */
function Expired({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <>
      <Text style={authStyles.title}>This link has expired</Text>
      <Text style={authStyles.sub}>
        Reset links last an hour and work once. Ask for a fresh one and you are back in a
        minute.
      </Text>
      {/*
        Only when it says something the headline did not. The generic falls out of a
        link the client cannot even attempt — a verifier it no longer holds — and
        "Something went wrong" under "This link has expired" is noise, not detail.
      */}
      {reason !== GENERIC && <Text style={styles.reason}>{reason}</Text>}
      <RewardButton
        label="Send a new link"
        glyph="♠"
        glyphColor={colors.gold}
        height={54}
        circleSize={36}
        onPress={onRetry}
      />
    </>
  );
}

const styles = StyleSheet.create({
  reason: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13 * 1.25,
    color: colors.textFaint,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
});
