import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FlipCard } from '../../components/FlipCard';
import { SilverFrame } from '../../components/Gold';
import { useScrollOffset } from '../../components/TabScreen';
import { Suit } from '../../components/ui';
import { boardLabel, splitCards } from '../../content/cards';
import type { DailyHand } from '../../content/daily';
import type { FaceCard } from '../../content/types';
import { useStore } from '../../state/store';
import { colors, font, ls, radius } from '../../theme/tokens';

/**
 * One question a day, face down until you turn it over — and it counts.
 *
 * The hand is a real question out of the unit the player is on, so it has an address in
 * `content_questions` and goes through `submit_answer` like any other: the server marks
 * it, pays the XP if it was right, and takes the heart if it was not. Nothing about it
 * is play money, which is why the card locks once it is answered rather than letting
 * anyone shop for the right option.
 *
 * That lock is local (see [[dailyHand]]) — it gates a card rather than deciding
 * anything, and a second device honestly gets one more crack at it.
 *
 * Two things the handoff is firm about, both because getting them wrong makes the card
 * unusable: the flip is a **swipe**, never a tap — a tap has to reach the answer
 * options — and the hidden face must not take presses, which `FlipCard` handles.
 */

const NATIVE = Platform.OS !== 'web';

/** A horizontal drag past this is a flip; anything less is a tap. */
const SWIPE = 40;

/** The cover's decorative heart, sized as the streak card sizes its spade. */
const HEART = 190;

/** Web-only, and not in React Native's style types — see StreakCard for why. */
const SWIPE_AREA = { touchAction: 'pan-y' } as unknown as ViewStyle;

/** Reveal once the card is this far into the pane. */
const REVEAL_FRACTION = 0.3;

/**
 * How much of the card shows before it is revealed.
 *
 * Not nothing: at zero the deck below the fold was a hole in the page, and the card
 * arrived from it out of nowhere. A dim card in the gap says there is something there
 * to scroll to, and the reveal brings it up rather than conjuring it.
 */
const GHOST = 0.22;

export function HandOfTheDay({ hand, day }: { hand: DailyHand; day: string }) {
  const { playedHand, answerDailyHand } = useStore();
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(false);

  // Yesterday's record is not today's hand, so the card opens again on its own.
  const played = playedHand?.day === day ? playedHand : null;
  const chosen = played?.optionId ?? null;

  const reveal = useRef(new Animated.Value(0)).current;
  const scrollY = useScrollOffset();
  const top = useRef<number | null>(null);
  const height = useRef(0);

  // The prototype uses an IntersectionObserver against the tab scroller. The same idea
  // here: the card's own offset, measured once, against the pane's scroll position.
  useEffect(() => {
    if (seen) return;
    if (!scrollY) {
      setSeen(true);
      return;
    }

    const check = (offset: number) => {
      if (top.current === null) return;
      // `top` is measured inside the scroll content, so the card's distance from the
      // top of the viewport is its offset minus how far we have scrolled
      const fromViewportTop = top.current - offset;
      if (fromViewportTop < 620 - height.current * REVEAL_FRACTION) setSeen(true);
    };

    check((scrollY as unknown as { __getValue(): number }).__getValue());
    const id = scrollY.addListener(({ value }) => check(value));
    return () => scrollY.removeListener(id);
  }, [scrollY, seen]);

  useEffect(() => {
    if (!seen) return;
    Animated.timing(reveal, {
      toValue: 1,
      duration: 550,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: NATIVE,
    }).start();
  }, [seen, reveal]);

  // Horizontal drags flip; vertical ones are left to the pane so the page still scrolls.
  // Captured on the way down as well as claimed on the way up — the question face is
  // covered in answer buttons, and a Pressable owns the gesture from the moment it is
  // touched, so a swipe that started on an option would never reach this otherwise.
  const horizontal = (g: { dx: number; dy: number }) =>
    Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => horizontal(g),
      onMoveShouldSetPanResponder: (_e, g) => horizontal(g),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > SWIPE) setFlipped((f) => !f);
      },
    }),
  ).current;

  const { hole, board } = splitCards(hand.question);
  // the caption drops the hold it used to spell out once the hand is really dealt
  const label = hole.length === 2 ? boardLabel(hand.question.cardsLabel) : hand.question.cardsLabel;
  const answered = chosen !== null;
  const right = answered && chosen === hand.question.correct;

  const cover = (
    <SilverFrame radius={radius.card} innerStyle={styles.cover}>
      {/* The streak card's decorative spade, in the suit this card is named for —
          right edge, halfway down, behind everything. */}
      <Suit glyph="♥" size={HEART} color="rgba(255,86,60,.16)" style={styles.heart} />
      <View style={styles.coverBody}>
        <Text style={styles.coverTitle}>Hand of the day</Text>
        <Text style={styles.coverHint}>{answered ? 'Played today ✓' : 'Flip to play →'}</Text>
      </View>
    </SilverFrame>
  );

  const question = (
    <SilverFrame radius={radius.card} innerStyle={styles.face}>
      <View style={styles.head}>
        <Text style={styles.kicker}>Hand of the day</Text>
        <Text style={styles.badge}>{hand.chapterTitle}</Text>
      </View>

      <Text style={styles.prompt}>{hand.question.prompt}</Text>

      {/* The whole fan, split the way the drill splits it: the board under the prompt,
          the hand the player is holding dealt in at the bottom over the answers. Showing
          one and not the other is a question nobody can answer without guessing. */}
      {board.length > 0 && (
        <View style={styles.boardWrap}>
          <View style={styles.board}>
            {board.map((c, i) => (
              <FaceUp key={i} card={c} />
            ))}
          </View>
          {label ? <Text style={styles.boardLabel}>{label}</Text> : null}
        </View>
      )}

      <Text style={styles.context}>{hand.question.context}</Text>

      {hole.length === 2 && (
        <View style={styles.hold}>
          <View style={styles.holdCards}>
            {hole.map((c, i) => (
              <FaceUp
                key={i}
                card={c}
                big
                style={{ transform: [{ rotate: i === 0 ? '-4deg' : '4deg' }] }}
              />
            ))}
          </View>
          <Text style={styles.holdLabel}>Your hand</Text>
        </View>
      )}

      <View style={styles.options}>
        {hand.question.options.map((o) => {
          const isCorrect = o.id === hand.question.correct;
          const picked = o.id === chosen;
          return (
            <Pressable
              key={o.id}
              onPress={() => !answered && answerDailyHand(hand, day, o.id)}
              disabled={answered}
              accessibilityRole="button"
              accessibilityState={{ selected: picked, disabled: answered }}
              style={[
                styles.option,
                answered && isCorrect && styles.optionRight,
                picked && !isCorrect && styles.optionWrong,
              ]}>
              <Text style={styles.optionLabel}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {answered && (
        <View style={[styles.feedback, right ? styles.feedbackRight : styles.feedbackWrong]}>
          <Text style={[styles.feedbackTitle, { color: right ? colors.gold : colors.redSoft }]}>
            {right ? '♠  Nicely played' : '♥  Not this time'}
          </Text>
          <Text style={styles.feedbackBody}>{hand.question.why}</Text>
          {/* One hand a day. It counted like any other — marked by the server, paid in
              XP if it was right, a heart short if it was not — so there is nothing left
              to offer until tomorrow deals a new one. */}
          <Text style={styles.feedbackAgain}>That’s today’s hand — back tomorrow with a new one.</Text>
        </View>
      )}
    </SilverFrame>
  );

  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={(e) => {
        top.current = e.nativeEvent.layout.y;
        height.current = e.nativeEvent.layout.height;
      }}
      style={{
        ...SWIPE_AREA,
        opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [GHOST, 1] }),
        transform: [
          { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
        ],
      }}>
      {/* Face down first, so the cover is the face in flow and the card is cover-sized
          on its opening frame — see FlipCard. */}
      <FlipCard flipped={flipped} front={cover} back={question} />
    </Animated.View>
  );
}

/** One card, face up. The board's are small; the pair in hand is dealt a size bigger. */
function FaceUp({
  card,
  big,
  style,
}: {
  card: FaceCard;
  big?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const red = card.suit === '♥' || card.suit === '♦';
  const ink = red ? colors.cardRed : colors.cardInk;
  return (
    <View style={[styles.card, big && styles.cardBig, style]}>
      <Text style={[styles.cardRank, big && styles.cardRankBig, { color: ink }]}>{card.rank}</Text>
      <Suit glyph={card.suit} size={big ? 16 : 14} color={ink} style={styles.cardSuit} />
    </View>
  );
}

const styles = StyleSheet.create({
  face: { padding: 18 },
  cover: { padding: 18, minHeight: 190, justifyContent: 'flex-end', overflow: 'hidden' },
  heart: { position: 'absolute', right: -10, top: '50%', marginTop: -HEART / 2, lineHeight: HEART },
  coverBody: { marginTop: 'auto' },
  coverTitle: {
    fontFamily: font.bold,
    fontSize: 26,
    lineHeight: 26 * 1.05,
    letterSpacing: ls(26, -0.02),
    color: colors.text,
    maxWidth: 150,
    marginBottom: 10,
  },
  coverHint: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.1),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.14),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  badge: {
    fontFamily: font.bold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.08),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  boardWrap: { marginTop: 12, marginBottom: 10 },
  board: { flexDirection: 'row', gap: 7 },
  boardLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.1),
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 7,
  },
  /** the pair in hand, dealt in at the bottom of the question over the answers */
  hold: { alignItems: 'center', marginBottom: 14 },
  holdCards: { flexDirection: 'row', gap: 8 },
  holdLabel: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.14),
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 7,
  },
  card: {
    width: 46,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.cardFace,
    paddingVertical: 6,
    paddingHorizontal: 7,
    justifyContent: 'space-between',
    boxShadow: '0 2px 6px rgba(0,0,0,.4)',
  },
  cardBig: { width: 54, height: 75, borderRadius: 11 },
  cardRank: { fontFamily: font.bold, fontSize: 15, lineHeight: 15 },
  cardRankBig: { fontSize: 17, lineHeight: 17 },
  cardSuit: { alignSelf: 'flex-end' },
  prompt: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 17 * 1.2,
    color: colors.text,
  },
  context: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.4,
    color: colors.textMuted,
    marginTop: 5,
    marginBottom: 14,
  },
  options: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  optionRight: { backgroundColor: colors.rewardAlt, borderColor: colors.goldRule },
  optionWrong: { backgroundColor: colors.redTintDeep, borderColor: colors.redBorder },
  optionLabel: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 13 * 1.15,
    color: colors.text,
    textAlign: 'center',
  },
  feedback: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  feedbackRight: { backgroundColor: colors.rewardAlt, borderColor: colors.goldRule },
  feedbackWrong: { backgroundColor: colors.redTintDeep, borderColor: colors.redBorder },
  feedbackTitle: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, marginBottom: 5 },
  /** the card is spent for the day, and says so under the explanation */
  feedbackAgain: {
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.08),
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 10,
  },
  feedbackBody: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.textSecondary,
  },
});
