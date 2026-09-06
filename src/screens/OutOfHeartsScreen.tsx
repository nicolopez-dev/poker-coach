import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pop, Rise } from '../components/anim';
import { Felt } from '../components/Felt';
import { RewardButton, Suit } from '../components/ui';
import { useCountdown } from '../components/useCountdown';
import { MAX_HEARTS, formatCountdown } from '../lib/hearts';
import { useStore } from '../state/store';
import { colors, font, ls, spacing, type } from '../theme/tokens';

/**
 * The end of a run, in the drill's own language: felt, a single suit at the top, the
 * count, and one way out. It stands where the drill stood — the overlay closes as this
 * opens — and it is also what a lesson opened with nothing left lands on.
 *
 * The wait is real time, measured against the server's clock through `clockOffset`, so
 * it is the same wait after a background cycle or a cold start (§3 rule 8).
 */
export function OutOfHeartsScreen() {
  const { hearts, nextHeartAt, clockOffset, dismissHearts, startNextLesson, refresh } = useStore();
  const remaining = useCountdown(nextHeartAt, clockOffset);

  const back = hearts > 0;
  const landed = !back && !!nextHeartAt && remaining === 0;

  // The heart the server promised is due. Ask for it rather than leaving the player on
  // a countdown that has run out — asked once per promised heart, so a refusal to
  // arrive does not turn into a poll.
  const asked = useRef(false);
  useEffect(() => {
    asked.current = false;
  }, [nextHeartAt]);

  useEffect(() => {
    if (!landed || asked.current) return;
    asked.current = true;
    refresh();
  }, [landed, refresh]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Felt />
      <Rise duration={300} style={styles.flex}>
        <View style={styles.column}>
          <Pop duration={400} style={styles.body}>
            <Suit glyph="♥" size={72} color={colors.red} style={styles.mark} />
            <Text style={styles.kicker}>{back ? 'Back in' : 'Out of hearts'}</Text>
            <Text style={[type.bigNumber, styles.count]}>
              {hearts} of {MAX_HEARTS}
            </Text>
            <Text style={styles.note}>
              {back
                ? "A heart is back. That's one hand — make it count."
                : landed
                  ? "You're out. The next one is landing now."
                  : `You're out. The next one lands in ${formatCountdown(remaining)}.`}
            </Text>
            {back ? (
              <RewardButton label="Deal me in" glyph="♠" onPress={startNextLesson} glow />
            ) : (
              <RewardButton label="Back to today" glyph="♠" onPress={dismissHearts} />
            )}
          </Pop>
        </View>
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 22, backgroundColor: colors.ground },
  flex: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: spacing.maxContentWidth, alignSelf: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 18 },
  mark: { marginBottom: 14 },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  count: { marginBottom: 10 },
  note: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 14 * 1.45,
    color: colors.textSecondary,
    marginBottom: 24,
  },
});
