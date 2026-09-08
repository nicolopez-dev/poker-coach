import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ChipDrop, Tilt } from '../../components/anim';
import { FlipCard } from '../../components/FlipCard';
import { ChipDisc } from '../../components/RankChip';
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
  onDouble,
  offerDouble,
  doubleLive,
  streak,
  dailyLabel,
  canPlay,
}: {
  done: number;
  goal: number;
  headline: string;
  cta: string;
  onDeal: () => void;
  /** take the day's ante */
  onDouble: () => void;
  /** the row is full and the ante has not been taken today */
  offerDouble: boolean;
  /** it has been taken and is still running */
  doubleLive: boolean;
  streak: number;
  dailyLabel: string;
  canPlay: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  /**
   * Swipe left or right to turn the card over.
   *
   * `Capture` matters: the front face carries the "Keep dealing" button, and a Pressable
   * claims the responder the moment a finger lands on it. Without capturing on *move*,
   * every swipe that began on the button would be swallowed by it and the card would
   * only ever flip from the dots below. Claiming on move rather than on start is what
   * leaves an ordinary tap free to reach the button.
   */
  const swipe = useRef(
    PanResponder.create({
      // capture, so a swipe that began on the button is taken off it
      onMoveShouldSetPanResponderCapture: (_e, g) => horizontal(g),
      // and again on the way up, for a swipe that began on the card itself
      onMoveShouldSetPanResponder: (_e, g) => horizontal(g),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > SWIPE) setFlipped((f) => !f);
      },
    }),
  ).current;

  const front = (
    <GoldFrame radius={radius.hero} innerStyle={styles.face}>
      <Sheen />
      {/* the handoff's decorative spade — front face only, behind everything */}
      <Suit glyph="♠" size={232} color="rgba(232,207,160,.16)" style={styles.spade} />

      <View style={styles.head}>
        <Text style={styles.kicker}>Today's streak</Text>
        <Text style={styles.dailyLabel}>{dailyLabel}</Text>
      </View>

      {/* A paid chip is a chip: milled edge, gold face, spade on it — the handoff paints
          that ring with a conic gradient, which is the same drawing the rank chip does. */}
      <View style={styles.chips}>
        {Array.from({ length: goal }, (_, i) => {
          const paid = i < done;
          const next = i === done;
          return (
            <ChipDrop key={i} duration={350} replayKey={done}>
              {paid ? (
                <View style={styles.chipPaid}>
                  <ChipDisc
                    size={CHIP}
                    colours={{ swatch: colors.goldRule, dash: '#ffffff' }}
                    face={colors.gold}
                    mark="♠"
                    markInk={colors.cardInk}
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.chip,
                    { borderColor: next ? colors.gold : 'rgba(255,255,255,.22)' },
                  ]}
                />
              )}
            </ChipDrop>
          );
        })}
      </View>

      <Text style={styles.headline}>{doubleLive ? 'You’re on a roll — every hand pays twice.' : headline}</Text>

      {/* Three things the button can be. Once the row is full the deal is done, so it
          offers the ante instead; once that is taken the card has nothing left to ask
          for and says what is running. */}
      {doubleLive ? (
        <View style={[styles.cta, styles.ctaLocked]}>
          <Text style={styles.ctaLockedLabel}>Double XP running</Text>
          <View style={styles.ctaGlyph}>
            <Suit glyph="♠" size={15} color={colors.gold} />
          </View>
        </View>
      ) : (
        <Pressable
          onPress={offerDouble ? onDouble : onDeal}
          accessibilityRole="button"
          style={pressable(styles.cta, 0.98)}>
          <Text style={styles.ctaLabel}>{offerDouble ? 'Ante up — double XP' : cta}</Text>
          <View style={styles.ctaGlyph}>
            <Suit
              glyph={offerDouble || canPlay ? '♠' : '♥'}
              size={15}
              color={offerDouble || canPlay ? colors.gold : colors.red}
            />
          </View>
        </Pressable>
      )}
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
      {/* `touchAction: pan-y` is web-only and ignored on native: it tells the browser
          the page scrolls vertically here and horizontal drags are ours, so it stops
          swallowing the pointer stream mid-swipe. */}
      <View {...swipe.panHandlers} style={SWIPE_AREA}>
        <Tilt>
          <FlipCard flipped={flipped} front={front} back={back} />
        </Tilt>
      </View>
      <Pressable
        onPress={() => setFlipped((f) => !f)}
        accessibilityRole="button"
        accessibilityState={{ expanded: flipped }}
        style={styles.toggle}>
        <View style={[styles.dot, !flipped && styles.dotOn]} />
        <View style={[styles.dot, flipped && styles.dotOn]} />
        <Text style={styles.toggleLabel}>Swipe or tap to flip</Text>
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
  {
    lead: 'A chip a drill, five to fill the row.',
    rest: 'Fill it and you can ante up: every answer worth double until you miss one.',
  },
  { lead: 'Skip a day and the run resets.', rest: 'Your XP and rank stay where they are.' },
];

/** The streak row's chips, as the handoff sizes them. */
const CHIP = 34;

/** A horizontal drag past this turns the card; anything less is a tap. */
const SWIPE = 40;

/**
 * Web-only, and absent from React Native's style types because native has no notion of
 * it: tells the browser this area scrolls vertically and that sideways drags belong to
 * the card, so it stops swallowing the pointer stream halfway through a swipe.
 */
const SWIPE_AREA = { touchAction: 'pan-y' } as unknown as ViewStyle;

/** A gesture is the card's once it is clearly sideways rather than a scroll. */
const horizontal = (g: { dx: number; dy: number }) =>
  Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;

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
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPaid: { borderRadius: CHIP / 2, ...shadows.chipLarge },
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
  /** the ante is running: the card has nothing left to ask for, so it stops asking */
  ctaLocked: { backgroundColor: colors.greenDeep },
  ctaLockedLabel: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: ls(13, 0.06),
    textTransform: 'uppercase',
    color: colors.gold,
  },
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
