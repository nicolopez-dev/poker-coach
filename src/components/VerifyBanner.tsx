import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { useStore } from '../state/store';
import { colors, font, ls, spacing } from '../theme/tokens';
import { pressable } from './ui';

/** How much room the strip takes under the header, when it is showing. */
export const VERIFY_BANNER_HEIGHT = 38;

/** Supabase's own email rate limit is per hour; this is just politeness. */
const COOLDOWN_SECONDS = 60;

/**
 * Whether the strip is up, and the room to leave for it.
 *
 * `TabScreen` reads this too so the panes start below the strip rather than under it —
 * a nag that permanently covers the top of the Home hero would be worse than no nag.
 */
export function useVerifyBanner(): { visible: boolean; height: number } {
  const { needsVerification } = useAuth();
  const { verifyDismissed } = useStore();
  const visible = needsVerification && !verifyDismissed;

  return { visible, height: visible ? VERIFY_BANNER_HEIGHT : 0 };
}

/**
 * The soft gate, made visible: verification nags but never blocks, so this is a thin
 * strip rather than a wall (§1). Dismissing it lasts the session — `verifyDismissed`
 * lives in the store, which clears itself the moment the session goes.
 *
 * Not shown to Google or Apple users: `needsVerification` already excludes anyone with
 * no password identity, because they have no address of ours to confirm.
 */
export function VerifyBanner() {
  const { user, resendVerification } = useAuth();
  const { dismissVerify } = useStore();
  const { visible } = useVerifyBanner();
  const insets = useSafeAreaInsets();

  const [cooldown, setCooldown] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const counting = cooldown > 0;

  // one interval per run of the countdown, not one per tick
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setCooldown((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(id);
  }, [counting]);

  const email = user?.email;
  if (!visible || !email) return null;

  async function resend() {
    if (counting) return;
    // the countdown starts on the press, not on the reply: a failure that came back
    // faster than a success would leak whether the send actually happened
    setCooldown(COOLDOWN_SECONDS);
    const outcome = await resendVerification(email!);
    setNote(outcome.ok ? 'Sent. Check your inbox.' : outcome.message);
  }

  return (
    <View style={[styles.strip, { top: insets.top + spacing.screen.paddingTop }]}>
      <View style={styles.column}>
        <Text style={styles.copy} numberOfLines={1}>
          {note ?? 'Confirm your email to keep your seat.'}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={resend}
            disabled={counting}
            accessibilityRole="button"
            accessibilityState={{ disabled: counting }}
            style={pressable()}>
            <Text style={[styles.action, counting && styles.actionSpent]}>
              {counting ? `Resend in ${cooldown}s` : 'Resend'}
            </Text>
          </Pressable>

          <Pressable onPress={dismissVerify} accessibilityLabel="Dismiss" style={pressable()}>
            <Text style={styles.dismiss}>✕</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    // under the header, which owns zIndex 6
    zIndex: 5,
    height: VERIFY_BANNER_HEIGHT,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineFaint,
    paddingHorizontal: spacing.screen.paddingHorizontal,
  },
  column: {
    width: '100%',
    maxWidth: spacing.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  copy: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textSecondary,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  action: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.02),
    color: colors.gold,
  },
  actionSpent: { color: colors.textFaint },
  dismiss: { fontFamily: font.regular, fontSize: 13, lineHeight: 13, color: colors.textFaint },
});
