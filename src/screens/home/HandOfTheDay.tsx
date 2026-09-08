import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FlipCard } from '../../components/FlipCard';
import { SilverFrame } from '../../components/Gold';
import { useScrollOffset } from '../../components/TabScreen';
import { Suit } from '../../components/ui';
import { splitCards } from '../../content/cards';
import type { DailyHand } from '../../content/daily';
import { colors, font, ls, radius } from '../../theme/tokens';

/**
 * One question a day, face down until you turn it over.
 *
 * It is deliberately outside the economy: no XP, no heart, nothing recorded. A taster
 * on the way past, which is why nothing here talks about rewards.
 *
 * Two things the handoff is firm about, both because getting them wrong makes the card
 * unusable: the flip is a **swipe**, never a tap — a tap has to reach the answer
 * options — and the hidden face must not take presses, which `FlipCard` handles.
 */

const NATIVE = Platform.OS !== 'web';

/** A horizontal drag past this is a flip; anything less is a tap. */
const SWIPE = 40;

/** Reveal once the card is this far into the pane. */
const REVEAL_FRACTION = 0.3;

export function HandOfTheDay({ hand }: { hand: DailyHand }) {
  const [flipped, setFlipped] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);

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
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > SWIPE) setFlipped((f) => !f);
      },
    }),
  ).current;

  const { hole, board } = splitCards(hand.question);
  const cards = hole.length === 2 ? hole : board;
  const answered = chosen !== null;
  const right = answered && chosen === hand.question.correct;

  const cover = (
    <SilverFrame radius={radius.card} innerStyle={styles.cover}>
      <Image
        source={require('../../../assets/joker-face.png')}
        style={styles.joker}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.coverBody}>
        <Text style={styles.coverTitle}>Hand of the day</Text>
        <Text style={styles.coverHint}>Flip to play →</Text>
      </View>
    </SilverFrame>
  );

  const question = (
    <SilverFrame radius={radius.card} innerStyle={styles.face}>
      <View style={styles.head}>
        <Text style={styles.kicker}>Hand of the day</Text>
        <Text style={styles.badge}>{hand.chapterTitle}</Text>
      </View>

      {cards.length > 0 && (
        <View style={styles.cards}>
          {cards.map((c, i) => {
            const red = c.suit === '♥' || c.suit === '♦';
            const ink = red ? colors.cardRed : colors.cardInk;
            return (
              <View key={i} style={styles.card}>
                <Text style={[styles.cardRank, { color: ink }]}>{c.rank}</Text>
                <Suit glyph={c.suit} size={14} color={ink} style={styles.cardSuit} />
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.prompt}>{hand.question.prompt}</Text>
      <Text style={styles.context}>{hand.question.context}</Text>

      <View style={styles.options}>
        {hand.question.options.map((o) => {
          const isCorrect = o.id === hand.question.correct;
          const picked = o.id === chosen;
          return (
            <Pressable
              key={o.id}
              onPress={() => !answered && setChosen(o.id)}
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
        opacity: reveal,
        transform: [
          { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
          { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}>
      <FlipCard flipped={!flipped} front={question} back={cover} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: { padding: 18 },
  cover: { padding: 18, minHeight: 190, justifyContent: 'flex-end', overflow: 'hidden' },
  joker: { position: 'absolute', right: -16, bottom: -14, width: 196, height: 245, opacity: 0.92 },
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
  cards: { flexDirection: 'row', gap: 7, marginBottom: 12 },
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
  cardRank: { fontFamily: font.bold, fontSize: 15, lineHeight: 15 },
  cardSuit: { alignSelf: 'flex-end' },
  prompt: {
    fontFamily: font.bold,
    fontSize: 17,
    lineHeight: 17 * 1.2,
    color: colors.text,
    marginBottom: 5,
  },
  context: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.4,
    color: colors.textMuted,
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
  feedbackBody: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.textSecondary,
  },
});
