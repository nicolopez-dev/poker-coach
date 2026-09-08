import React, { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { RANKS, levelLabel } from '../data/ranks';
import { absoluteFill, colors, font } from '../theme/tokens';
import { Suit } from './ui';

/**
 * The rank chip — a casino chip you can spin, drag and flip.
 *
 * Entertainment only: nothing it does changes any data. It is mounted twice (Home's
 * rank card and the You tab's), and each instance is told which rank to wear — Home is
 * pinned to the live rank, You follows the ladder selection. See handoff 02 §5.1.
 *
 * ## What React Native could not take from the CSS
 *
 * The handoff builds the chip out of `transform-style: preserve-3d`, faces pushed apart
 * with `translateZ(5px)`, a 24-segment milled rim standing in 3D space, and a
 * `repeating-conic-gradient` ground. React Native has **none** of those: no
 * `preserve-3d`, no `translateZ` in the transform list, no conic gradients, and no
 * z-sorting between sibling views. So:
 *
 *   · **The flip is real.** Two sibling faces, each with its own `perspective` and a
 *     `rotateY` 180° apart, both `backfaceVisibility: 'hidden'`. This is the one piece
 *     of CSS 3D that RN reproduces exactly.
 *   · **The milled edge is drawn, not composed.** Twelve wedges in SVG reproduce what
 *     the conic gradient painted on the face. It is the same picture by another means.
 *   · **The standing rim is gone**, and something had to replace it: with the rim, a
 *     chip turned edge-on shows its cylinder side; without it the disc would simply
 *     vanish for a frame every half-turn. So a slab sits behind the faces and is scaled
 *     by |sin(ry)| — widest exactly when the faces are thinnest. It reads as the chip's
 *     thickness and costs one view instead of twenty-four.
 *
 * ## Why a timer and not `Animated.loop`
 *
 * The idle spin is specced as `ry += 1.1°` every 55ms — a slow, unbounded rotation that
 * a drag interrupts mid-flight and that has to hand its current angle to the ease-back.
 * A native-driven loop cannot be read or interrupted like that. The interval writes
 * straight to an `Animated.Value` instead, which updates the view without re-rendering
 * React, so the cost is one bridge write per tick and nothing above it.
 */

/** Rest angle — the chip sits slightly turned rather than face-on. */
const REST_RX = -14;
const REST_RY = -18;

/** Idle spin, from the handoff: 1.1° every 55ms ≈ 20°/s. */
const SPIN_STEP = 1.1;
const SPIN_MS = 55;

/** How long the chip stays where it was left before easing home. */
const SETTLE_MS = 1600;
const RETURN_MS = 600;

/** Under this much travel a press is a tap — which flips the chip — not a drag. */
const TAP_SLOP = 6;

/** Wedges of the milled edge, and how wide each one is. 12 × 30° with an 8° dash. */
const WEDGES = 12;
const WEDGE_DEG = 8;

const NATIVE = Platform.OS !== 'web';

/** Keeps an angle in (−180, 180] so the edge slab can interpolate over a fixed range. */
const wrap = (deg: number) => (((deg + 180) % 360) + 360) % 360 - 180;

/** One dash of the milled edge, as a pie slice from the centre out to the rim. */
function wedge(index: number, r: number): string {
  const from = ((index * 360) / WEDGES - 90) * (Math.PI / 180);
  const to = from + WEDGE_DEG * (Math.PI / 180);
  const x0 = r + r * Math.cos(from);
  const y0 = r + r * Math.sin(from);
  const x1 = r + r * Math.cos(to);
  const y1 = r + r * Math.sin(to);
  return `M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

/**
 * One side of the chip: milled ground, then the inner disc, then its mark.
 *
 * The inner disc is drawn over whole pie slices rather than clipping each one to an
 * annulus — same picture, twelve fewer arcs to get wrong.
 */
function ChipFace({
  swatch,
  dash,
  ink,
  size,
  children,
}: {
  swatch: string;
  dash: string;
  ink: string;
  size: number;
  children: React.ReactNode;
}) {
  const r = size / 2;
  // the handoff's `inset: 7px` on a 72px chip — kept proportional so any size reads right
  const inner = r - (7 / 72) * size;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={absoluteFill}>
        <Circle cx={r} cy={r} r={r} fill={swatch} />
        {Array.from({ length: WEDGES }, (_, i) => (
          <Path key={i} d={wedge(i, r)} fill={dash} />
        ))}
        <Circle
          cx={r}
          cy={r}
          r={inner}
          fill={swatch}
          stroke="rgba(255,255,255,.45)"
          strokeWidth={1}
        />
      </Svg>
      <View style={[absoluteFill, styles.mark]}>
        <Text style={[styles.label, { color: ink, fontSize: size * (18 / 72) }]}>{children}</Text>
      </View>
    </View>
  );
}

/**
 * A chip that does not turn — the ladder's swatches, and anywhere else a rank needs a
 * face rather than a toy. Same drawing as {@link RankChip}, without the machinery.
 */
export function ChipDisc({
  rankIndex,
  size,
  dimmed = false,
}: {
  rankIndex: number;
  size: number;
  dimmed?: boolean;
}) {
  const rank = RANKS[rankIndex] ?? RANKS[0];
  return (
    <View style={dimmed ? styles.dimmed : undefined}>
      <ChipFace swatch={rank.swatch} dash={rank.dash} ink={rank.ink} size={size}>
        {null}
      </ChipFace>
    </View>
  );
}

export function RankChip({
  rankIndex,
  size = 72,
  accessibilityLabel,
}: {
  rankIndex: number;
  size?: number;
  accessibilityLabel?: string;
}) {
  const rank = RANKS[rankIndex] ?? RANKS[0];

  // The angles live in refs as plain numbers as well as in Animated.Values: the timer
  // and the pan responder both need to read the current angle synchronously, and an
  // Animated.Value cannot be read without a listener.
  const rx = useRef(REST_RX);
  const ry = useRef(REST_RY);
  const rxA = useRef(new Animated.Value(REST_RX)).current;
  const ryA = useRef(new Animated.Value(REST_RY)).current;

  /** null while the player has not touched it — the chip is free to spin. */
  const touchedAt = useRef<number | null>(null);
  const dragging = useRef(false);
  const returning = useRef(false);
  const start = useRef({ rx: REST_RX, ry: REST_RY, moved: 0 });

  const set = (nextRx: number, nextRy: number) => {
    rx.current = nextRx;
    ry.current = wrap(nextRy);
    rxA.setValue(rx.current);
    ryA.setValue(ry.current);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (dragging.current || returning.current) return;

      if (touchedAt.current !== null) {
        if (Date.now() - touchedAt.current <= SETTLE_MS) return;

        // Left alone long enough: ease home, then let the idle spin pick up again.
        touchedAt.current = null;
        returning.current = true;
        rx.current = REST_RX;
        ry.current = REST_RY;
        Animated.parallel([
          Animated.timing(rxA, {
            toValue: REST_RX,
            duration: RETURN_MS,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: NATIVE,
          }),
          Animated.timing(ryA, {
            toValue: REST_RY,
            duration: RETURN_MS,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: NATIVE,
          }),
        ]).start(() => {
          returning.current = false;
        });
        return;
      }

      set(rx.current, ry.current + SPIN_STEP);
    }, SPIN_MS);

    return () => clearInterval(timer);
  }, [rxA, ryA]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        returning.current = false;
        rxA.stopAnimation();
        ryA.stopAnimation();
        start.current = { rx: rx.current, ry: ry.current, moved: 0 };
      },
      onPanResponderMove: (_e, g) => {
        start.current.moved = Math.max(start.current.moved, Math.abs(g.dx) + Math.abs(g.dy));
        set(start.current.rx - g.dy * 0.6, start.current.ry + g.dx * 0.8);
      },
      onPanResponderRelease: () => {
        dragging.current = false;
        // A press that went nowhere is a tap, and a tap turns the chip over.
        if (start.current.moved < TAP_SLOP) set(rx.current, ry.current + 180);
        touchedAt.current = Date.now();
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        touchedAt.current = Date.now();
      },
    }),
  ).current;

  const spin = (offset: number) =>
    ryA.interpolate({
      inputRange: [-180, 180],
      outputRange: [`${-180 + offset}deg`, `${180 + offset}deg`],
    });

  const tilt = rxA.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  // The chip's thickness, seen only when the faces are turned away: |sin(ry)|, sampled
  // at the quarter-turns and interpolated between.
  const edge = ryA.interpolate({
    inputRange: [-180, -90, 0, 90, 180],
    outputRange: [0, 1, 0, 1, 0],
  });

  const face = (offset: number, children: React.ReactNode) => (
    <Animated.View
      style={[
        absoluteFill,
        styles.face,
        { transform: [{ perspective: size * 5.8 }, { rotateX: tilt }, { rotateY: spin(offset) }] },
      ]}>
      <ChipFace swatch={rank.swatch} dash={rank.dash} ink={rank.ink} size={size}>
        {children}
      </ChipFace>
    </Animated.View>
  );

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${rank.name}, level ${rankIndex + 1}`}
      style={{ width: size, height: size }}>
      <Animated.View
        style={[
          absoluteFill,
          styles.thickness,
          {
            backgroundColor: rank.dash,
            width: size * (10 / 72),
            left: size / 2 - size * (5 / 72),
            transform: [{ scaleX: edge }],
          },
        ]}
      />
      {face(0, levelLabel(rankIndex))}
      {face(180, <Suit glyph="♠" size={size * (20 / 72)} color={rank.ink} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden' },
  /** stands in for the handoff's 24-segment rim — see the note at the top of the file */
  thickness: {
    right: undefined,
    borderRadius: 999,
    boxShadow: '0 3px 10px rgba(0,0,0,.5)',
  },
  mark: { alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.bold, color: colors.text },
  /** a rank the player has not reached yet */
  dimmed: { opacity: 0.38 },
});
