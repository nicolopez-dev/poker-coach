import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rise } from '../components/anim';
import { DoubleXpChip, FRAME } from '../components/DoubleXpChip';
import { Felt } from '../components/Felt';
import { RewardCard } from '../components/Gold';
import { PENDING, RewardButton, StatPill } from '../components/ui';
import { useCountdown } from '../components/useCountdown';
import { useVerifyBanner } from '../components/VerifyBanner';
import { XP_PER_ANSWER } from '../content/types';
import { formatCountdown } from '../lib/hearts';
import { useStore } from '../state/store';
import { colors, font, ls, radius, spacing, TOUCH, type } from '../theme/tokens';

/**
 * The ante, taken: the 2X XP chip lands, and the card underneath says what it buys.
 *
 * Laid out from the design's `Lesson Boost.dc.html` — title, the chip's stage, then the
 * reward card, two pills and the button rising in at 2.3s, just ahead of the chip's lock.
 * The header stays on top, as it does in the design, so this sits under it rather than
 * over it the way the drill does.
 *
 * The design's copy is for a different boost — "the next 30 minutes", "+80 XP earned" —
 * and the server's ante is not that. `take_double` doubles every right answer, 8 XP to
 * 16, until the first wrong one or the player's midnight, whichever comes first
 * (20260913120000_doubles_reset_at_midnight). The words below say that instead.
 */
export function AnteScreen() {
  const { streakExpiresAt, clockOffset, canPlay, closeAnte, startNextLesson } = useStore();
  const insets = useSafeAreaInsets();
  const banner = useVerifyBanner();
  const { height: windowHeight } = useWindowDimensions();
  const untilMidnight = useCountdown(streakExpiresAt, clockOffset);

  // The stage bleeds to the column's edges, and the chip needs its width before it can
  // be framed — so it is not dealt until the stage has been measured.
  const [stageWidth, setStageWidth] = useState(0);

  // The design is drawn for a 390 × 844 phone. Narrower and the chip scales with the
  // width; shorter and the stage gives up height before anything else does.
  const room = windowHeight - insets.top - insets.bottom - banner.height - SURROUNDINGS;
  const scale = Math.max(
    MIN_SCALE,
    Math.min(1, stageWidth / FRAME.width || 1, room / STAGE_HEIGHT),
  );

  const deal = () => {
    closeAnte();
    startNextLesson();
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Felt />
      <View
        style={[
          styles.column,
          {
            paddingTop: spacing.screen.paddingTop + 10 + insets.top + banner.height,
            paddingBottom: 28 + insets.bottom,
          },
        ]}>
        <View style={styles.head}>
          <Text style={type.kicker}>Five of five drills</Text>
          <Text style={[type.screenTitle, styles.title]}>The ante is in</Text>
        </View>

        <View
          onLayout={(e) => setStageWidth(e.nativeEvent.layout.width)}
          style={[styles.stage, { height: STAGE_HEIGHT * scale }]}>
          {stageWidth > 0 && (
            <DoubleXpChip
              width={stageWidth}
              scale={scale}
              // the frame is taller than the stage and centred on it, as the iframe is
              style={[styles.chip, { top: -STAGE_OVERHANG * scale }]}
            />
          )}
        </View>

        <Rise delay={2300} style={styles.reward}>
          <RewardCard radius={radius.card} innerStyle={styles.cardInner}>
            <View style={styles.cardBody}>
              <Text style={[type.kicker, styles.cardKicker]}>Boost unlocked</Text>
              <Text style={type.heroTitle}>2X XP</Text>
              <Text style={[type.body, styles.cardNote]}>
                Every right answer pays double until you miss one, or the day turns.
              </Text>
            </View>
          </RewardCard>

          <View style={styles.pills}>
            <View style={styles.pill}>
              <StatPill value={String(XP_PER_ANSWER * 2)} label="XP when right" />
            </View>
            <View style={styles.pill}>
              <StatPill
                value={streakExpiresAt ? formatCountdown(untilMidnight) : PENDING}
                label="Until midnight"
              />
            </View>
          </View>

          {canPlay ? (
            <>
              <RewardButton label="Deal me in" glyph="♠" onPress={deal} glow />
              <Pressable onPress={closeAnte} accessibilityRole="button" style={styles.later}>
                <Text style={styles.laterLabel}>Back to today</Text>
              </Pressable>
            </>
          ) : (
            <RewardButton label="Back to today" glyph="♥" onPress={closeAnte} glow />
          )}
        </Rise>
      </View>
    </View>
  );
}

/** The chip's stage, and how far its frame rises above it — the design's 300 and −70. */
const STAGE_HEIGHT = 300;
const STAGE_OVERHANG = 70;

/**
 * Everything on the screen that is not the stage, near enough, at full size: the
 * design's 76 and 28 of padding, the title, and the card, pills and buttons under it.
 */
const SURROUNDINGS = 460;

/** Below this the chip stops being the point of the screen. */
const MIN_SCALE = 0.6;

const styles = StyleSheet.create({
  // Under the header (6) and the verify strip (5), over the tab bar (1).
  overlay: { zIndex: 4, backgroundColor: colors.ground },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: spacing.maxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.screen.paddingHorizontal,
  },
  head: { alignItems: 'center', gap: 10 },
  title: {
    textAlign: 'center',
    textShadowColor: 'rgba(8,13,10,.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  stage: { marginHorizontal: -spacing.screen.paddingHorizontal },
  chip: { position: 'absolute', left: 0 },
  reward: { gap: 14 },
  cardInner: { paddingVertical: 20, paddingHorizontal: 20 },
  cardBody: { alignItems: 'center', gap: 8 },
  cardKicker: { color: colors.gold },
  cardNote: { maxWidth: 260, textAlign: 'center' },
  pills: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1 },
  later: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
  laterLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.08),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
