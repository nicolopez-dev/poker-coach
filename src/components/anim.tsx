/**
 * The handoff's motion set, rebuilt on the React Native Animated API.
 * Names and timings match the "Motion" table in docs/design-handoff/README.md.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleProp, ViewStyle } from 'react-native';

import { absoluteFill } from '../theme/tokens';

/** react-native-web has no native driver; asking for one only logs a warning. */
const NATIVE = Platform.OS !== 'web';

type AnimProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** ms before the animation starts */
  delay?: number;
  duration?: number;
  /** change this to replay the animation */
  replayKey?: string | number;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

/** `rise` — translateY(14px) + fade in. */
export function Rise({ children, style, delay = 0, duration = 350, replayKey }: AnimProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.ease,
      useNativeDriver: NATIVE,
    }).start();
  }, [t, duration, delay, replayKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** `pop` — scale(.92 → 1.02 → 1) + fade. */
export function Pop({ children, style, delay = 0, duration = 350, replayKey }: AnimProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.ease,
      useNativeDriver: NATIVE,
    }).start();
  }, [t, duration, delay, replayKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [
            { scale: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.92, 1.02, 1] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** `shake` — ±7px horizontal. */
export function Shake({ children, style, duration = 400, replayKey }: AnimProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      easing: Easing.ease,
      useNativeDriver: NATIVE,
    }).start();
  }, [t, duration, replayKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            {
              translateX: t.interpolate({
                inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                outputRange: [0, -7, 6, -4, 2, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/**
 * A refusal: `shake` at half the amplitude and twice the rate, played on demand.
 *
 * `Shake` answers a wrong answer, so it plays the moment it mounts and every time its
 * key changes. This one answers a press on something locked, which means it must *not*
 * play on mount — a grid of locked cards would all shiver on arrival — so the first
 * render is skipped and only a change of `count` after that shakes anything.
 */
export function Nudge({
  children,
  style,
  duration = 320,
  count,
}: AnimProps & { count: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: NATIVE,
    }).start();
  }, [t, duration, count]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            {
              translateX: t.interpolate({
                inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
                outputRange: [0, -5, 5, -4, 4, -2, 2, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** `chipdrop` — translateY(-18px) rotate(-12deg) → 0. */
export function ChipDrop({ children, style, delay = 0, duration = 350, replayKey }: AnimProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.ease,
      useNativeDriver: NATIVE,
    }).start();
  }, [t, duration, delay, replayKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
            {
              rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** `flipa` / `flipb` — rotateY(∓84°) → 0, alternating by question parity. */
export function Flip({
  children,
  style,
  index,
  duration = 500,
}: AnimProps & { index: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: NATIVE,
    }).start();
  }, [t, duration, index]);

  const from = index % 2 === 0 ? '-84deg' : '84deg';
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
          transform: [
            { perspective: 800 },
            { rotateY: t.interpolate({ inputRange: [0, 1], outputRange: [from, '0deg'] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** `tilt3d` — 8s loop, rotateX ±2°, rotateY ±2.4°, translate3d(±5px, ∓4px). */
export function Tilt({
  children,
  style,
  delay = 0,
  reverse = false,
}: AnimProps & { reverse?: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: NATIVE,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: NATIVE,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);

  // the result card runs the same loop backwards, so the two never sync up
  const at = (a: number, b: number) =>
    t.interpolate({ inputRange: [0, 1], outputRange: reverse ? [b, a] : [a, b] });
  const deg = (a: string, b: string) =>
    t.interpolate({ inputRange: [0, 1], outputRange: reverse ? [b, a] : [a, b] });

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { perspective: 900 },
            { rotateX: deg('2deg', '-2deg') },
            { rotateY: deg('-2.4deg', '2.4deg') },
            { translateX: at(-5, 5) },
            { translateY: at(4, -4) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/** How far the `glow` halo reaches past the pill at its peak, on every side. */
const GLOW_SPREAD = 6;

/**
 * `glow` — 2.6s pulse behind a pill button. The handoff animates a box-shadow's spread,
 * which RN cannot do, so a gold halo sits behind the button and grows past its edge.
 *
 * It grows by the same number of pixels on all four sides, like a spread would. A single
 * `scale` cannot do that on a wide pill — 6% of 350px is 21px across but 3px down, which
 * smeared the halo out sideways — so the button is measured and X and Y are scaled
 * separately. The spread is tighter than the handoff's 9px (see README deviations).
 */
export function Glow({ children, style, radius = 999 }: AnimProps & { radius?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: NATIVE,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const halo = useMemo(() => {
    if (!size || size.width === 0 || size.height === 0) return null;
    const peak = (length: number) => (length + 2 * GLOW_SPREAD) / length;
    const pulse = (to: number) =>
      t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, to, 1] });
    return {
      ...absoluteFill,
      pointerEvents: 'none' as const,
      borderRadius: radius,
      backgroundColor: 'rgba(232,207,160,.30)',
      // fades as it shrinks back, so no hairline of gold is left at the pill's edge
      opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }),
      transform: [{ scaleX: pulse(peak(size.width)) }, { scaleY: pulse(peak(size.height)) }],
    };
  }, [t, radius, size]);

  return (
    <Animated.View
      style={style}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
      }}>
      {halo ? <Animated.View style={halo} /> : null}
      {children}
    </Animated.View>
  );
}

/** Drives the `sheen` overlay: an 8s loop value other components interpolate. */
export function useSheen(delay = 0) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: NATIVE,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: NATIVE,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return t;
}
