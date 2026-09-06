import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { Rise } from '../../components/anim';
import { OutlineButton, Suit } from '../../components/ui';
import { lapseSeen, markLapseSeen } from '../../server/streakAck';
import { useStore } from '../../state/store';
import { colors, font, ls, radius, shadows } from '../../theme/tokens';

/**
 * A run that ended, said once.
 *
 * It appears when the state comes back with a stored streak that resolves live to zero —
 * the definition of a lapse (§6) — and it is remembered against the day it ended, so it
 * is acknowledged rather than nagged. A player who has never had a streak has nothing to
 * be told, and sees nothing.
 *
 * Muted, not alarming: the run is already gone, and red is not for regret.
 */
export function StreakLapseCard() {
  const { hydrated, streak, storedStreak, streakDay, longestStreak, startNextLesson } = useStore();
  const { user } = useAuth();

  const lapsed = hydrated && storedStreak > 0 && streak === 0 && streakDay !== null;
  const userId = user?.id ?? null;

  // `null` while the answer is unknown, so a card that was already dismissed never
  // flashes up on the way to being hidden
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    if (!lapsed || !userId || !streakDay) {
      setShow(false);
      return;
    }

    let live = true;
    lapseSeen(userId, streakDay).then((seen) => {
      if (live) setShow(!seen);
    });

    return () => {
      live = false;
    };
  }, [lapsed, userId, streakDay]);

  if (show !== true || !streakDay) return null;

  const dismiss = () => {
    setShow(false);
    if (userId) void markLapseSeen(userId, streakDay);
  };

  return (
    <Rise duration={300} style={styles.card}>
      <View style={styles.head}>
        <Suit glyph="♠" size={16} color={colors.textMuted} />
        <Text style={styles.kicker}>The run ended</Text>
      </View>
      <Text style={styles.title}>
        {storedStreak} {storedStreak === 1 ? 'day' : 'days'}, and then a day missed.
      </Text>
      <Text style={styles.body}>
        {longestStreak > storedStreak
          ? `Your best is still ${longestStreak}. One hand today starts the next one.`
          : 'That was your best run yet. One hand today starts the next one.'}
      </Text>
      <View style={styles.actions}>
        <OutlineButton
          label="Start again"
          glyph="♠"
          height={46}
          onPress={startNextLesson}
          style={styles.again}
        />
        <OutlineButton label="Dismiss" height={46} onPress={dismiss} style={styles.dismiss} />
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...shadows.row,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 15 * 1.25,
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  actions: { flexDirection: 'row', gap: 8 },
  /** takes the width so the suit sits at the far edge, as the outline pills are drawn */
  again: { flex: 1 },
  dismiss: { paddingHorizontal: 18 },
});
