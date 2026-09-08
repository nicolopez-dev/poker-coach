import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { absoluteFill } from '../theme/tokens';

/**
 * A card with two sides that turns over and stays turned.
 *
 * `anim.tsx`'s `Flip` is a one-shot entry animation — it plays once when a question
 * appears and has no second face. This is the other thing: a persistent state, driven
 * by a prop, used by Home's streak card and the Hand of the day.
 *
 * Two rules from handoff 02 §1.3 and §1.5 are load-bearing:
 *
 *   · **The front sits in normal flow** and the back is absolute over it, so the card is
 *     as tall as whichever face is showing rather than a fixed box with a dead strip
 *     under it.
 *   · **The hidden face must not take taps.** `backfaceVisibility` hides it visually,
 *     but it stays in the layer and would swallow every press meant for the face behind
 *     it — the handoff calls this out because it makes the card unanswerable.
 */

const NATIVE = Platform.OS !== 'web';
const DURATION = 550;

export function FlipCard({
  flipped,
  front,
  back,
  style,
  duration = DURATION,
}: {
  /** false shows the front, true shows the back */
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const t = useRef(new Animated.Value(flipped ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: flipped ? 1 : 0,
      duration,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: NATIVE,
    }).start();
  }, [flipped, t, duration]);

  const face = (from: string, to: string) => ({
    transform: [
      { perspective: 1400 },
      { rotateY: t.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) },
    ],
  });

  return (
    <View style={style}>
      <Animated.View
        style={[styles.face, face('0deg', '180deg')]}
        // pointerEvents belongs in style on RN, and gating it on flip state is what
        // keeps the face underneath reachable
        pointerEvents={flipped ? 'none' : 'auto'}>
        {front}
      </Animated.View>
      <Animated.View
        style={[absoluteFill, styles.face, face('180deg', '360deg')]}
        pointerEvents={flipped ? 'auto' : 'none'}>
        {back}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden' },
});
