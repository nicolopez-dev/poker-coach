import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { RANKS, levelLabel } from '../data/ranks';
import { shade } from '../lib/color';
import { absoluteFill, colors, font } from '../theme/tokens';
import { Suit } from './ui';

/**
 * The rank chip — a casino chip you can spin, drag and flip.
 *
 * Entertainment only: nothing it does changes any data. It is mounted twice (Home's rank
 * card and the You tab's), and each instance is told which rank to wear — Home is pinned
 * to the live rank, You follows the ladder selection. See handoff 02 §5.1.
 *
 * ## Why this draws its own geometry
 *
 * The handoff builds the chip out of `transform-style: preserve-3d`, faces pushed apart
 * with `translateZ`, and a 24-segment rim standing in 3D space. React Native has none of
 * those, and the obvious fallback — two flat faces that swap on `backfaceVisibility` —
 * reads as a disc, not a chip: it has no edge, so it vanishes to nothing every half turn.
 *
 * So the projection is done here instead. The chip is modelled as what it is, a short
 * cylinder: a ring of quads for the milled edge and a polygon for each face, all rotated
 * about Y then X, divided through by a camera distance and handed to SVG as flat paths.
 * Every facet is then shaded by how squarely it faces the light, which is what makes a
 * cylinder look round rather than like a stack of coloured strips.
 *
 * The cost is that the geometry is a function of the angle, so it cannot be handed to
 * the native driver — the angles are ordinary React state and the shapes are recomputed
 * per frame. At the handoff's own 55ms cadence and ~30 paths that is cheap, and it is
 * what the prototype does too.
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

/** The milling: a dash every 30°, as wide as the handoff's conic gradient cuts it. */
const MILL_DASHES = 12;
const MILL_DASH_ARC = 8;

/** Points around a face, enough that its outline reads as a curve. */
const FACE_POINTS = 48;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Where the light sits, in view space. Up, to the left, and in front. */
const LIGHT = { x: -0.35, y: -0.62, z: 0.7 };

type Vec = { x: number; y: number; z: number };

/** Rotate about Y, then X — the order the handoff's `rotateX(..) rotateY(..)` composes in. */
function rotate({ x, y, z }: Vec, rx: number, ry: number): Vec {
  const cy = Math.cos(ry * DEG);
  const sy = Math.sin(ry * DEG);
  const cx = Math.cos(rx * DEG);
  const sx = Math.sin(rx * DEG);

  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;

  return { x: x1, y: y * cx - z1 * sx, z: y * sx + z1 * cx };
}

/** Keeps an angle in (−180, 180]. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** How squarely a surface meets the light, 0–1. */
function lambert(n: Vec): number {
  return Math.max(0, n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z);
}

/**
 * The milled edge takes the light hard — that swing from facet to facet is what reads as
 * a curved surface rather than a row of stripes.
 */
const rimLight = (n: Vec) => 0.5 + 0.72 * lambert(n);

/**
 * The face takes it gently. It is the printed side of the chip and has to stay its own
 * colour: a white chip that goes grey when it turns just looks like a different chip.
 */
const faceLight = (n: Vec) => 0.82 + 0.24 * lambert(n);

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

  // The angles drive the geometry, so they are plain state: there is nothing here a
  // native-driven transform could carry.
  const [angle, setAngle] = useState({ rx: REST_RX, ry: REST_RY });
  const live = useRef(angle);
  live.current = angle;

  /** null while the player has not touched it — the chip is free to spin. */
  const touchedAt = useRef<number | null>(null);
  const dragging = useRef(false);
  const returning = useRef(false);
  const start = useRef({ rx: REST_RX, ry: REST_RY, moved: 0 });
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const set = (rx: number, ry: number) => setAngle({ rx, ry: wrap(ry) });

  /** Ease back to rest, then let the idle spin pick up again. */
  const easeHome = () => {
    returning.current = true;
    const from = { ...live.current };
    // the shortest way round, so a chip left face-down does not unwind the long way
    const dry = wrap(REST_RY - from.ry);
    const began = Date.now();

    const step = () => {
      const t = Math.min(1, (Date.now() - began) / RETURN_MS);
      // the handoff's cubic-bezier(.2,.8,.2,1), near enough for a 600ms settle
      const eased = 1 - Math.pow(1 - t, 3);
      set(from.rx + (REST_RX - from.rx) * eased, from.ry + dry * eased);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      returning.current = false;
    };
    step();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (dragging.current || returning.current) return;

      if (touchedAt.current !== null) {
        if (Date.now() - touchedAt.current <= SETTLE_MS) return;
        touchedAt.current = null;
        easeHome();
        return;
      }

      set(live.current.rx, live.current.ry + SPIN_STEP);
    }, SPIN_MS);

    return () => {
      clearInterval(timer);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
    // easeHome closes over refs only, and the timer must not be rebuilt every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        returning.current = false;
        if (raf.current !== null) cancelAnimationFrame(raf.current);
        start.current = { ...live.current, moved: 0 };
      },
      onPanResponderMove: (_e, g) => {
        start.current.moved = Math.max(start.current.moved, Math.abs(g.dx) + Math.abs(g.dy));
        set(start.current.rx - g.dy * 0.6, start.current.ry + g.dx * 0.8);
      },
      onPanResponderRelease: () => {
        dragging.current = false;
        // a press that went nowhere is a tap, and a tap turns the chip over
        if (start.current.moved < TAP_SLOP) set(live.current.rx, live.current.ry + 180);
        touchedAt.current = Date.now();
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        touchedAt.current = Date.now();
      },
    }),
  ).current;

  const chip = geometry(angle.rx, angle.ry, size, rank);

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${rank.name}, level ${rankIndex + 1}`}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {chip.facets.map((f) => (
          <Polygon key={f.key} points={f.points} fill={f.fill} />
        ))}
        <Polygon points={chip.face.points} fill={chip.face.fill} />
        {chip.mill.map((m) => (
          <Polygon key={m.key} points={m.points} fill={m.fill} />
        ))}
        <Path d={chip.disc.d} fill={chip.disc.fill} stroke={chip.disc.ring} strokeWidth={1} />
      </Svg>

      {/* The mark rides the face: shifted to where the face centre projects, and squashed
          by however much the face is turned away. */}
      <View
        style={[
          styles.mark,
          {
            transform: [
              { translateX: chip.mark.x },
              { translateY: chip.mark.y },
              { scaleX: chip.mark.scaleX },
              { scaleY: chip.mark.scaleY },
            ],
          },
        ]}>
        {chip.mark.front ? (
          <Text style={[styles.label, { color: rank.ink, fontSize: size * (18 / 72) }]}>
            {levelLabel(rankIndex)}
          </Text>
        ) : (
          <Suit glyph="♠" size={size * (20 / 72)} color={rank.ink} />
        )}
      </View>
    </View>
  );
}

/**
 * The chip as flat shapes: the facets of its edge that face the camera, the face that
 * does, and where its mark has to sit.
 *
 * Pure, so it can be read — and tested — without mounting anything.
 */
export function geometry(
  rx: number,
  ry: number,
  size: number,
  rank: { swatch: string; dash: string },
) {
  const c = size / 2;
  // a little short of the box, so the edge has room when the chip turns broadside
  const R = c * 0.92;
  const T = size * (5 / 72);
  const inner = R - (7 / 72) * size;
  const camera = size * 5.8;

  const to2d = (v: Vec) => {
    const s = camera / (camera - v.z);
    return { x: c + v.x * s, y: c + v.y * s };
  };
  const at = (x: number, y: number, z: number) => to2d(rotate({ x, y, z }, rx, ry));

  // The face that is turned towards us — front at +T, back at −T.
  const frontNormal = rotate({ x: 0, y: 0, z: 1 }, rx, ry);
  const front = frontNormal.z > 0;
  const faceZ = front ? T : -T;
  const lit = faceLight(front ? frontNormal : { x: -frontNormal.x, y: -frontNormal.y, z: -frontNormal.z });

  const ring = (radius: number, z: number) =>
    Array.from({ length: FACE_POINTS }, (_, i) => {
      const u = (i / FACE_POINTS) * TAU;
      return at(radius * Math.cos(u), radius * Math.sin(u), z);
    });

  // The milling, as the handoff cuts it: a narrow dash every 30° around the chip. The
  // same arcs drive both the edge and the ring on the face, so a dash carries over the
  // corner instead of the two patterns sliding past each other.
  const segments: { u0: number; u1: number; dash: boolean }[] = [];
  for (let i = 0; i < MILL_DASHES; i++) {
    const start = (i / MILL_DASHES) * TAU;
    const cut = start + MILL_DASH_ARC * DEG;
    segments.push({ u0: start, u1: cut, dash: true });
    segments.push({ u0: cut, u1: start + TAU / MILL_DASHES, dash: false });
  }

  const facets: { key: string; points: string; fill: string }[] = [];
  segments.forEach((seg, i) => {
    const um = (seg.u0 + seg.u1) / 2;
    const normal = rotate({ x: Math.cos(um), y: Math.sin(um), z: 0 }, rx, ry);
    if (normal.z <= 0) return; // this facet is round the back

    const corners = [
      at(R * Math.cos(seg.u0), R * Math.sin(seg.u0), -T),
      at(R * Math.cos(seg.u0), R * Math.sin(seg.u0), T),
      at(R * Math.cos(seg.u1), R * Math.sin(seg.u1), T),
      at(R * Math.cos(seg.u1), R * Math.sin(seg.u1), -T),
    ];

    facets.push({
      key: `f${i}`,
      points: corners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      fill: shade(seg.dash ? rank.dash : rank.swatch, rimLight(normal)),
    });
  });

  // And the same dashes cut into the face's outer ring, which is what makes the chip
  // still read as a chip when it is turned square on and has no edge to show.
  const mill = segments
    .filter((seg) => seg.dash)
    .map((seg, i) => {
      const arc = [0, 0.34, 0.67, 1].map((t) => seg.u0 + (seg.u1 - seg.u0) * t);
      const outer = arc.map((u) => at(R * Math.cos(u), R * Math.sin(u), faceZ));
      const back = [...arc].reverse().map((u) => at(inner * Math.cos(u), inner * Math.sin(u), faceZ));
      return {
        key: `m${i}`,
        points: [...outer, ...back].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
        fill: shade(rank.dash, lit),
      };
    });

  const facePoints = ring(R, faceZ);
  const discPoints = ring(inner, faceZ);

  // The mark's box is the full chip; scaling it about its centre foreshortens the glyph
  // exactly as the face it sits on is foreshortened.
  const centre = at(0, 0, faceZ);
  const edgeX = at(R, 0, faceZ);
  const edgeY = at(0, -R, faceZ);

  return {
    facets,
    mill,
    face: {
      points: facePoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
      fill: shade(rank.swatch, lit),
    },
    disc: {
      d: `${discPoints.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('')}Z`,
      fill: shade(rank.swatch, lit * 1.04),
      ring: 'rgba(255,255,255,.45)',
    },
    mark: {
      front,
      x: centre.x - c,
      y: centre.y - c,
      scaleX: Math.abs(edgeX.x - centre.x) / R,
      scaleY: Math.abs(edgeY.y - centre.y) / R,
    },
  };
}

/**
 * A chip that does not turn — the ladder's swatches, and anywhere else a rank needs a
 * face rather than a toy. Same drawing as {@link RankChip}, held at the rest angle.
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
  const chip = geometry(REST_RX, REST_RY, size, rank);

  return (
    <View style={[{ width: size, height: size }, dimmed && styles.dimmed]}>
      <Svg width={size} height={size}>
        {chip.facets.map((f) => (
          <Polygon key={f.key} points={f.points} fill={f.fill} />
        ))}
        <Polygon points={chip.face.points} fill={chip.face.fill} />
        {chip.mill.map((m) => (
          <Polygon key={m.key} points={m.points} fill={m.fill} />
        ))}
        <Circle
          cx={chip.mark.x + size / 2}
          cy={chip.mark.y + size / 2}
          r={(size / 2) * 0.72 * chip.mark.scaleX}
          fill={chip.disc.fill}
          stroke={chip.disc.ring}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  label: { fontFamily: font.bold, color: colors.text },
  /** a rank the player has not reached yet */
  dimmed: { opacity: 0.38 },
});
