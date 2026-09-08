import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { Rise } from '../components/anim';
import { AuthField, OutlineButton } from '../components/ui';
import { eraseAccount } from '../server/account';
import { colors, font, ls, radius, spacing, TOUCH, type } from '../theme/tokens';

/** The word that has to be typed out. Matched case-insensitively, after a trim. */
const CONFIRM = 'DELETE';

/**
 * The last step before an account ends.
 *
 * Apple 5.1.1(v) wants this reachable in the app rather than through a support address,
 * and GDPR wants it at all — so the only question left is how hard to make it. Typing the
 * word is the friction; the colour is not. There is no red button here and no alarm,
 * because red belongs to the chip action, hearts, the "Playing" badge and the chip tool's
 * focus rings, and turning it into a warning colour on one screen would weaken it on all
 * the others. What does the work is saying plainly what goes.
 *
 * Rendered as a sibling of the You pane rather than inside it — a sheet inside a
 * `ScrollView` would scroll with the page — which is why it carries its own `zIndex`:
 * above the header and the tab bar, below the auth gate that takes the screen the moment
 * the sign-out lands.
 */
export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ready = typed.trim().toUpperCase() === CONFIRM;

  async function confirm() {
    if (!ready || deleting) return;

    setError(null);
    setDeleting(true);
    const outcome = await eraseAccount(user?.id ?? null);

    if (!outcome.ok) {
      setError(outcome.message);
      setDeleting(false);
      return;
    }

    // The account is gone, so there is no session left to end globally — `local` clears
    // this device and the Google session behind it without asking a server that would
    // now have nobody to answer about.
    await signOut('local');
    onClose();
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} accessibilityViewIsModal>
      {/* the scrim closes it, unless the delete is already on its way */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Dismiss"
        onPress={deleting ? undefined : onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottom}>
        <Rise duration={260} style={styles.column}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <Text style={[type.sectionHeading, styles.title]}>Delete your account</Text>
            <Text style={styles.body}>
              This cannot be undone. Your progress, your streak, every lesson you have
              finished and every game you have saved go with the account — on this phone and
              on any other.
            </Text>

            <Text style={styles.hint}>Type {CONFIRM} to confirm.</Text>
            <AuthField
              value={typed}
              onChangeText={(value) => {
                setTyped(value);
                if (error) setError(null);
              }}
              placeholder={CONFIRM}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              editable={!deleting}
              returnKeyType="done"
              onSubmitEditing={confirm}
              style={styles.field}
            />

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <OutlineButton
              label={deleting ? 'Deleting…' : 'Delete account'}
              disabled={!ready || deleting}
              onPress={confirm}
              style={styles.confirm}
            />

            <Pressable
              onPress={deleting ? undefined : onClose}
              disabled={deleting}
              accessibilityRole="button"
              style={styles.cancel}>
              <Text style={styles.cancelLabel}>Keep my seat</Text>
            </Pressable>
          </View>
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** above the header (6) and the tab bar, below the auth gate (30) */
  overlay: { zIndex: 24, backgroundColor: 'rgba(4,8,6,.72)' },
  /** `box-none` so the empty space above the sheet still reaches the scrim behind it */
  bottom: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  column: { width: '100%', maxWidth: spacing.maxContentWidth, alignSelf: 'center' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: 22,
    paddingHorizontal: 20,
  },
  title: { marginBottom: 8 },
  body: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  hint: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  /** the one field on the screen, at the auth screens' scale */
  field: { letterSpacing: ls(14, 0.08) },
  /**
   * Red for a failed action, as on the auth screens — the one other place the app has to
   * be unmissable.
   */
  error: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13 * 1.25,
    color: colors.red,
    paddingHorizontal: 2,
    marginTop: 9,
  },
  confirm: { marginTop: 16 },
  cancel: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelLabel: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
