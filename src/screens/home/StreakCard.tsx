import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipDrop, Tilt } from '../../components/anim';
import { FlipCard } from '../../components/FlipCard';
import { GoldFrame, Sheen } from '../../components/Gold';
import { Suit, pressable } from '../../components/ui';
import { colors, font, ls, radius, shadows } from '../../theme/tokens';

/**
 * Today's streak: a chip per drill, and the button that deals the next one.
 *
 * Turning it over explains the run. The handoff drives that with a swipe *or* a tap on
 * the dots beneath, and both are here — the front face also carries the CTA, so a tap
 * anywhere on the card itself would fight the button.
 */
export function StreakCard({
  done,
  goal,
  headline,
  cta,
  onDeal,
  streak,
  dailyLabel,
  canPlay,
}: {
  done: number;
  goal: number;
  headline: string;
  cta: string;
  onDeal: () => void;
  streak: number;
  dailyLabel: string;
  canPlay: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  const front = (
    <GoldFrame radius={radius.hero} innerStyle={styles.face}>
      <Sheen />
      {/* the handoff's decorative spade — front face only, behind everything */}
      <Suit glyph="♠" size={232} color="rgba(232,207,160,.16)" style={styles.spade} />

      <View style={styles.head}>
        <Text style={styles.kicker}>Today's streak</Text>
        <Text style={styles.dailyLabel}>{dailyLabel}</Text>
      </View>

      <View style={styles.chips}>
        {Array.from({ length: goal }, (_, i) => {
          const paid = i < done;
          const next = i === done;
          return (
            <ChipDrop key={i} duration={350} replayKey={done}>
              <View
                style={[
                  styles.chip,
                  paid
                    ? styles.chipPaid
                    : { borderColor: next ? colors.gold : 'rgba(255,255,255,.22)' },
                ]}>
                {paid && <Suit glyph="♠" size={11} color={colors.cardInk} />}
              </View>
            </ChipDrop>
          );
        })}
      </View>

      <Text style={styles.headline}>{headline}</Text>

      <Pressable
        onPress={onDeal}
        accessibilityRole="button"
        style={pressable(styles.cta, 0.98)}>
        <Text style={styles.ctaLabel}>{cta}</Text>
        <View style={styles.ctaGlyph}>
          <Suit glyph={canPlay ? '♠' : '♥'} size={15} color={canPlay ? colors.gold : colors.red} />
        </View>
      </Pressable>
    </GoldFrame>
  );

  const back = (
    <GoldFrame radius={radius.hero} innerStyle={styles.face}>
      <Sheen />
      <Text style={[styles.kicker, styles.backKicker]}>How the streak works</Text>
      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step.lead} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberLabel}>{i + 1}</Text>
            </View>
            <Text style={styles.stepBody}>
              <Text style={styles.stepLead}>{step.lead}</Text> {step.rest}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.backFooter}>
        Right now: {dailyLabel} · {streak}-day run
      </Text>
    </GoldFrame>
  );

  return (
    <View>
      <Tilt>
        <FlipCard flipped={flipped} front={front} back={back} />
      </Tilt>
      <Pressable
        onPress={() => setFlipped((f) => !f)}
        accessibilityRole="button"
        accessibilityState={{ expanded: flipped }}
        style={styles.toggle}>
        <View style={[styles.dot, !flipped && styles.dotOn]} />
        <View style={[styles.dot, flipped && styles.dotOn]} />
        <Text style={styles.toggleLabel}>{flipped ? 'Back to today' : 'How it works'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * What the back face says. Step 2 is deliberately not the handoff's "All five chips in,
 * and today turns face-up" — the server extends a run on the *first* completed lesson of
 * the day (`complete_lesson`, §6 of the economy migration), so five is the day's target
 * and one is what keeps the streak. Saying otherwise would be telling players they had
 * lost a run they still hold.
 */
const STEPS = [
  { lead: 'One drill keeps the run.', rest: 'Finish a single lesson and today counts.' },
  { lead: 'Five is the day’s work.', rest: 'Each drill pays another chip into the row.' },
  { lead: 'Skip a day and the run resets.', rest: 'Your XP and rank stay where they are.' },
];

const styles = StyleSheet.create({
  face: { padding: 20, ...shadows.big, overflow: 'hidden' },
  spade: { position: 'absolute', right: -14, top: '50%', marginTop: -116, lineHeight: 232 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.14),
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.6)',
  },
  backKicker: { marginBottom: 14 },
  dailyLabel: { fontFamily: font.bold, fontSize: 11, lineHeight: 13, color: colors.gold },
  chips: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPaid: {
    backgroundColor: colors.gold,
    borderColor: colors.goldRule,
    borderStyle: 'solid',
    ...shadows.chipLarge,
  },
  headline: {
    fontFamily: font.bold,
    fontSize: 19,
    lineHeight: 19 * 1.15,
    letterSpacing: ls(19, -0.015),
    color: colors.textOnReward,
    marginBottom: 16,
    maxWidth: 280,
  },
  cta: {
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.cardFace,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 12,
  },
  ctaLabel: { fontFamily: font.bold, fontSize: 15, lineHeight: 17, color: colors.cardInk },
  ctaGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { gap: 11, marginBottom: 14 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberLabel: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, color: colors.cardInk },
  stepBody: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.4,
    color: 'rgba(255,255,255,.85)',
  },
  stepLead: { fontFamily: font.bold, color: colors.textOnReward },
  backFooter: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 11 * 1.35,
    color: 'rgba(255,255,255,.55)',
  },
  toggle: {
    minHeight: 44,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dot: { width: 16, height: 5, borderRadius: 3, backgroundColor: colors.greenSpent },
  dotOn: { backgroundColor: colors.gold },
  toggleLabel: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.08),
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginLeft: 4,
  },
});
