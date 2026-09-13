import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FaceCard } from '../content/types';
import { colors, font, ls } from '../theme/tokens';
import { Suit } from './ui';

/**
 * The two cards the player is holding, dealt in from the bottom of the question and
 * fanned. Tapping opens the pair out flat; tapping again folds it back (handoff 02 §2).
 *
 * The prototype does this with two stacked elements: an outer one carrying the CSS
 * animations that rise and split the pair, and an inner one carrying the tap pose, so
 * the two **compose** — open, the split's outward tilt and the pose's inward tilt cancel
 * and the cards stand upright. That nesting is kept here rather than flattened into one
 * transform, because the cancelling is the whole trick.
 */

const CARD_W = 52;
const CARD_H = 72;

/** The clipping box, closed and open. */
const BOX_CLOSED = 84;
const BOX_OPEN = 102;

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const NATIVE = Platform.OS !== 'web';

/** The intro, from the handoff: rise for .5s, then split over .38s starting at .48s. */
const RISE_MS = 500;
const SPLIT_DELAY = 480;
const SPLIT_MS = 380;
const OPEN_MS = 380;

export function HeldHand({ hole, replayKey }: { hole: FaceCard[]; replayKey: number }) {
  const rise = useRef(new Animated.Value(0)).current;
  const split = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);

  // A new question deals a new hand: rewind and play the intro again, closed.
  useEffect(() => {
    rise.setValue(0);
    split.setValue(0);
    open.setValue(0);
    setIsOpen(false);

    Animated.parallel([
      Animated.timing(rise, {
        toValue: 1,
        duration: RISE_MS,
        easing: EASE,
        useNativeDriver: NATIVE,
      }),
      Animated.timing(split, {
        toValue: 1,
        delay: SPLIT_DELAY,
        duration: SPLIT_MS,
        easing: EASE,
        useNativeDriver: NATIVE,
      }),
    ]).start();
  }, [replayKey, rise, split, open]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    Animated.timing(open, {
      toValue: next ? 1 : 0,
      duration: OPEN_MS,
      easing: EASE,
      // the box's height animates alongside, and height is not a native prop
      useNativeDriver: false,
    }).start();
  };

  const height = open.interpolate({ inputRange: [0, 1], outputRange: [BOX_CLOSED, BOX_OPEN] });

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`Your hand: ${hole.map((c) => `${c.rank}${c.suit}`).join(' ')}`}>
        <Animated.View style={[styles.box, { height }]}>
          {/* index 0 is the left card and sits on top, as the handoff stacks them */}
          <HoleCard card={hole[1]} side={1} rise={rise} split={split} open={open} z={1} />
          <HoleCard card={hole[0]} side={-1} rise={rise} split={split} open={open} z={2} />
        </Animated.View>
      </Pressable>
      <Text style={styles.caption}>Your hand</Text>
    </View>
  );
}

function HoleCard({
  card,
  side,
  rise,
  split,
  open,
  z,
}: {
  card: FaceCard;
  /** −1 for the left card, +1 for the right */
  side: -1 | 1;
  rise: Animated.Value;
  split: Animated.Value;
  open: Animated.Value;
  z: number;
}) {
  const red = card.suit === '♥' || card.suit === '♦';
  const ink = red ? colors.cardRed : colors.cardInk;

  // Outer: rises from under the clipping box, then fans outward and stays there.
  const outer = {
    opacity: rise.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) },
      { translateX: split.interpolate({ inputRange: [0, 1], outputRange: [0, side * 20] }) },
      { translateY: split.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
      {
        rotate: split.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${side * 8}deg`],
        }),
      },
    ],
  };

  // Inner: the tap pose. Its rotation is the opposite of the fan's, so an open hand
  // stands upright — the two tilts cancel.
  const inner = {
    transform: [
      { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [0, side * 11] }) },
      { translateY: open.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
      {
        rotate: open.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${side * -8}deg`],
        }),
      },
      { scale: open.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
    ],
  };

  return (
    <Animated.View style={[styles.slot, { zIndex: z }, outer]}>
      <Animated.View style={[styles.card, inner]}>
        <Text style={[styles.rank, { color: ink }]}>{card.rank}</Text>
        <Suit glyph={card.suit} size={16} color={ink} style={styles.suit} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 7, marginBottom: 4 },
  /** clips the cards while they rise in from below */
  box: { width: 150, overflow: 'hidden' },
  slot: {
    position: 'absolute',
    left: '50%',
    bottom: -14,
    marginLeft: -CARD_W / 2,
    width: CARD_W,
    height: CARD_H,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    backgroundColor: colors.cardFace,
    paddingVertical: 7,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    boxShadow: '0 3px 12px rgba(0,0,0,.55)',
    transformOrigin: '50% 100%',
  },
  rank: { fontFamily: font.bold, fontSize: 17, lineHeight: 17 },
  suit: { alignSelf: 'flex-end' },
  caption: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.08),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
