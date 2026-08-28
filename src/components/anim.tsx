/**
 * The handoff's motion set, rebuilt on the React Native Animated API.
 * Names and timings match the "Motion" table in docs/design-handoff/README.md.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleProp, ViewStyle } from 'react-native';

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

/** `glow` — 2.6s pulse behind a pill button (a ring, since RN can't animate shadows). */
export function Glow({ children, style, radius = 999 }: AnimProps & { radius?: number }) {
  const t = useRef(new Animated.Value(0)).current;
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

  const ring = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      pointerEvents: 'none' as const,
      borderRadius: radius,
      borderWidth: 9,
      borderColor: 'rgba(232,207,160,.30)',
      opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 0] }),
      transform: [
        { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] }) },
      ],
    }),
    [t, radius],
  );

  return (
    <Animated.View style={style}>
      <Animated.View style={ring} />
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
