import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { AceCard } from '../components/AceCard';
import { Rise } from '../components/anim';
import { Avatar } from '../components/Avatar';
import { Felt } from '../components/Felt';
import { AuthField, Brand, RewardButton } from '../components/ui';
import { AVATARS, DEFAULT_AVATAR_ID } from '../data/avatars';
import { NAME_MAX_LENGTH } from '../lib/names';
import { saveProfile } from '../server/profile';
import { useStore } from '../state/store';
import { authStyles } from './authStyles';
import { colors, font, ls, radius } from '../theme/tokens';

/** The server's own check, in `profiles`: `char_length(display_name) between 2 and 24`. */
const MIN_NAME = 2;
const TOO_SHORT = 'Two characters at least — what should we call you?';

/**
 * Name and face. Shown once after sign-up, and again whenever someone taps "Edit
 * profile" on the You screen, which is why it prefills from the store rather than
 * assuming it is starting from nothing.
 *
 * A new account has a session before it has a name, so this renders *over* a signed-in
 * app — see `authScreenShowing`.
 */
export function ProfileSetupScreen() {
  const { goTo } = useAuth();
  const store = useStore();
  const insets = useSafeAreaInsets();

  const editing = store.displayName !== null;
  const [name, setName] = useState(store.displayName ?? '');
  const [avatarId, setAvatarId] = useState(store.avatarId ?? DEFAULT_AVATAR_ID);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (saving) return;

    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME) return setError(TOO_SHORT);

    setError(null);
    setSaving(true);
    const outcome = await saveProfile(trimmed, avatarId);

    if (!outcome.ok) {
      setError(outcome.message);
      setSaving(false);
      return;
    }

    // keep the store in step with what the server now holds, then drop the gate
    store.setProfile(outcome.profile);
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

          <Text style={authStyles.title}>{editing ? 'Your seat' : 'Take your seat'}</Text>
          <Text style={authStyles.sub}>
            {editing
              ? 'Change how you show up at the table.'
              : 'A name for the table, and a card to play under.'}
          </Text>

          <View style={{ gap: 9 }}>
            <AuthField
              value={name}
              onChangeText={(value) => {
                setName(value.slice(0, NAME_MAX_LENGTH));
                if (error) setError(null);
              }}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={NAME_MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={finish}
            />
            <Text style={authStyles.hint}>
              Two to {NAME_MAX_LENGTH} characters. Only the table sees it.
            </Text>
          </View>

          <Text style={styles.pickLabel}>Your card</Text>
          <View style={styles.grid}>
            {AVATARS.map((avatar) => {
              const picked = avatar.id === avatarId;
              return (
                <Pressable
                  key={avatar.id}
                  onPress={() => setAvatarId(avatar.id)}
                  accessibilityRole="button"
                  accessibilityLabel={avatar.id}
                  accessibilityState={{ selected: picked }}
                  style={({ pressed }) => [pressed && styles.tilePressed]}>
                  <Avatar
                    avatarId={avatar.id}
                    size={52}
                    style={[styles.tile, picked && styles.tilePicked]}
                  />
                </Pressable>
              );
            })}
          </View>

          {error && (
            <Text style={[authStyles.error, styles.error]} accessibilityRole="alert">
              {error}
            </Text>
          )}

          <RewardButton
            label={saving ? 'Dealing…' : editing ? 'Save' : 'Sit down'}
            glyph="♠"
            glyphColor={colors.gold}
            height={54}
            circleSize={36}
            disabled={saving}
            onPress={finish}
            style={{ marginTop: 18 }}
          />

          {editing && (
            <View style={authStyles.footer}>
              <Pressable onPress={() => goTo('login')} accessibilityRole="button">
                <Text style={authStyles.back}>Back to the table</Text>
              </Pressable>
            </View>
          )}
        </Rise>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pickLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 22,
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /** Same ring the chip swatches use: 2px hairline, 3px gold when picked. */
  tile: {
    borderWidth: 2,
    borderColor: 'rgba(240,239,233,.2)',
    borderRadius: radius.pill,
  },
  tilePicked: { borderColor: colors.gold, borderWidth: 3 },
  tilePressed: { transform: [{ scale: 0.96 }] },
  error: { marginTop: 12 },
});
