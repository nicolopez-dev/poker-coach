import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * A card with two sides that turns over and stays turned.
 *
 * `anim.tsx`'s `Flip` is a one-shot entry animation — it plays once when a question
 * appears and has no second face. This is the other thing: a persistent state, driven
 * by a prop, used by Home's streak card and the Hand of the day.
 *
 * Two rules from handoff 02 §1.3 and §1.5 are load-bearing:
 *
 *   · **The card is only as tall as the face that is showing** — never a fixed box with
 *     a dead strip under the shorter face. Both faces are measured and the card
 *     *travels* between the two heights on the same curve as the turn, so the page
 *     below settles with the card instead of jumping when it lands.
 *   · **The hidden face must not take taps.** `backfaceVisibility` hides it visually,
 *     but it stays in the layer and would swallow every press meant for the face behind
 *     it — the handoff calls this out because it makes the card unanswerable.
 *
 * Pass the face that shows first as `front`: it is the one in normal flow, so the card
 * has the right height on its very first frame, before either face has been measured.
 */

const NATIVE = Platform.OS !== 'web';
const DURATION = 550;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

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
      easing: EASE,
      useNativeDriver: NATIVE,
    }).start();
  }, [flipped, t, duration]);

  const [faces, setFaces] = useState({ front: 0, back: 0 });
  const height = useRef(new Animated.Value(0)).current;
  const settled = useRef(false);

  const sized = faces.front > 0 && faces.back > 0;
  const showing = flipped ? faces.back : faces.front;

  /**
   * The showing face's height, travelled to rather than jumped to.
   *
   * Two things move it: the turn, and a face growing under its own feet — answering the
   * hand of the day adds a feedback box to a face that is already up. Both want the same
   * easing, so both get it; the first measurement is set rather than animated, because
   * there is nothing yet to travel from.
   */
  useEffect(() => {
    if (!sized) return;
    if (!settled.current) {
      settled.current = true;
      height.setValue(showing);
      return;
    }
    Animated.timing(height, {
      toValue: showing,
      duration,
      easing: EASE,
      // height is a layout prop, so this one cannot ride the native driver
      useNativeDriver: false,
    }).start();
  }, [showing, sized, height, duration]);

  const measure = (side: 'front' | 'back') => (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setFaces((f) => (f[side] === h ? f : { ...f, [side]: h }));
  };

  const face = (from: string, to: string) => ({
    transform: [
      { perspective: 1400 },
      { rotateY: t.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) },
    ],
  });

  return (
    <Animated.View style={[style, sized ? { height } : null]}>
      {/* `pointerEvents` goes in style, not as a prop; gating it on the flip state is
          what keeps the face underneath reachable */}
      <Animated.View
        onLayout={measure('front')}
        style={[styles.face, face('0deg', '180deg'), { pointerEvents: flipped ? 'none' : 'auto' }]}>
        {front}
      </Animated.View>
      <Animated.View
        onLayout={measure('back')}
        style={[
          styles.back,
          styles.face,
          face('180deg', '360deg'),
          { pointerEvents: flipped ? 'auto' : 'none' },
        ]}>
        {back}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden' },
  /**
   * Out of flow, but *not* `absoluteFill`: pinning the bottom would stretch this face to
   * the card, and the card is sized from the faces — it would only ever measure itself.
   */
  back: { position: 'absolute', top: 0, left: 0, right: 0 },
});
