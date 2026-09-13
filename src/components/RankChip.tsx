import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { RANKS, levelLabel } from '../data/ranks';
import { shade } from '../lib/color';
import { absoluteFill, colors, font } from '../theme/tokens';

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

/** How long a tap takes to carry the chip through its half turn. */
const FLIP_MS = 520;

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

/** The handoff's `cubic-bezier(.2,.8,.2,1)`, near enough over half a second. */
export const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/**
 * How far a turn has got, `t` from 0 to 1.
 *
 * Both angles are carried **unwrapped**, so a half turn really travels a half turn.
 * Wrapping mid-flight is what turns an animation into a jump: the shortest equivalent
 * angle to "180° from here" is "here".
 */
export function turnAt(
  from: { rx: number; ry: number },
  to: { rx: number; ry: number },
  t: number,
): { rx: number; ry: number } {
  const e = ease(t);
  return { rx: from.rx + (to.rx - from.rx) * e, ry: from.ry + (to.ry - from.ry) * e };
}

/** The rest angle expressed as a target reachable the short way round from `ry`. */
export const restFrom = (ry: number) => ({ rx: REST_RX, ry: ry + wrap(REST_RY - ry) });

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

  const stopTween = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    returning.current = false;
  };

  /**
   * Turn the chip to an angle over time.
   *
   * `toRy` is **unwrapped** on purpose: the caller says how far to go, not merely where
   * to end up, so a flip can travel a deliberate half turn and a settle can take the
   * short way home. Wrapping it here would collapse both into "the nearest equivalent
   * angle" and the chip would arrive without having gone anywhere.
   */
  const tween = (toRx: number, toRy: number, ms: number) => {
    stopTween();
    const from = { ...live.current };
    const began = Date.now();
    returning.current = true;

    const step = () => {
      const t = Math.min(1, (Date.now() - began) / ms);
      const now = turnAt(from, { rx: toRx, ry: toRy }, t);
      set(now.rx, now.ry);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      raf.current = null;
      returning.current = false;
    };

    raf.current = requestAnimationFrame(step);
  };

  /** Ease back to rest the short way round, then let the idle spin pick up again. */
  const easeHome = () => {
    const home = restFrom(live.current.ry);
    tween(home.rx, home.ry, RETURN_MS);
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
        stopTween();
        start.current = { ...live.current, moved: 0 };
      },
      onPanResponderMove: (_e, g) => {
        start.current.moved = Math.max(start.current.moved, Math.abs(g.dx) + Math.abs(g.dy));
        set(start.current.rx - g.dy * 0.6, start.current.ry + g.dx * 0.8);
      },
      onPanResponderRelease: () => {
        dragging.current = false;
        touchedAt.current = Date.now();
        // A press that went nowhere is a tap, and a tap turns the chip over — through
        // the half turn, not straight to the other side of it.
        if (start.current.moved < TAP_SLOP) {
          const { rx, ry } = live.current;
          tween(rx, ry + 180, FLIP_MS);
        }
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
        <Mark chip={chip} rank={rank} rankIndex={rankIndex} size={size} />
      </Svg>
    </View>
  );
}

/**
 * The level or the spade, printed on whichever face is showing.
 *
 * It lives inside the SVG rather than as a `<Text>` over it because only SVG will take
 * an arbitrary affine matrix. A React Native transform list could scale the glyph but
 * not shear it, so a chip tilted on both axes made the mark shrink instead of lean with
 * the face it is painted on.
 */
function Mark({
  chip,
  rank,
  rankIndex,
  size,
}: {
  chip: ReturnType<typeof geometry>;
  rank: { ink: string };
  rankIndex: number;
  size: number;
}) {
  const fontSize = size * (chip.mark.front ? 18 : 20) / 72;

  return (
    <G transform={`matrix(${chip.mark.matrix.map((n) => n.toFixed(4)).join(' ')})`}>
      <SvgText
        x={0}
        // SVG hangs text off its baseline; a third of the size down centres a cap-height glyph
        y={fontSize * 0.35}
        textAnchor="middle"
        fill={rank.ink}
        fontSize={fontSize}
        // The spade is deliberately given no family: Archivo ships no card glyphs, so it
        // falls to the platform font exactly as `<Suit>` does elsewhere.
        fontFamily={chip.mark.front ? font.bold : undefined}
        fontWeight={chip.mark.front ? undefined : '700'}>
        {chip.mark.front ? levelLabel(rankIndex) : '♠'}
      </SvgText>
    </G>
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

  // Where the face's own two axes land on screen. Taken together as an affine matrix
  // they carry the turn and the lean, not just the squash — which is what makes the mark
  // ride the face instead of merely shrinking on the spot when the chip is tilted.
  const centre = at(0, 0, faceZ);
  const alongX = at(R, 0, faceZ);
  const alongY = at(0, R, faceZ);

  // The back is seen from behind, so its x axis runs the other way; negating it keeps
  // the glyph the right way round rather than mirrored.
  const handed = front ? 1 : -1;
  const matrix = [
    (handed * (alongX.x - centre.x)) / R,
    (handed * (alongX.y - centre.y)) / R,
    (alongY.x - centre.x) / R,
    (alongY.y - centre.y) / R,
    centre.x,
    centre.y,
  ];

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
      /** `matrix(a b c d e f)` straight onto an SVG group */
      matrix,
      x: centre.x - c,
      y: centre.y - c,
      // how far each axis is foreshortened, for anything that only needs the magnitude
      scaleX: Math.hypot(alongX.x - centre.x, alongX.y - centre.y) / R,
      scaleY: Math.hypot(alongY.x - centre.x, alongY.y - centre.y) / R,
    },
  };
}

/**
 * A chip that does not turn — the ladder's swatches, and anywhere else a rank needs a
 * face rather than a toy. Same drawing as {@link RankChip}, held at the rest angle.
 */
export function ChipDisc({
  rankIndex,
  colours,
  size,
  dimmed = false,
  face,
  mark,
  markInk,
}: {
  /** which rank to wear; ignored when `colours` is given */
  rankIndex?: number;
  /** an explicit chip, for the ones that are not ranks — the streak row's, say */
  colours?: { swatch: string; dash: string };
  size: number;
  dimmed?: boolean;
  /** the inner disc, when it is not the swatch itself */
  face?: string;
  /** a glyph on that disc */
  mark?: string;
  markInk?: string;
}) {
  const chip = geometry(
    REST_RX,
    REST_RY,
    size,
    colours ?? RANKS[rankIndex ?? 0] ?? RANKS[0],
  );
  const discR = (size / 2) * 0.72 * chip.mark.scaleX;

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
          r={discR}
          fill={face ?? chip.disc.fill}
          stroke={chip.disc.ring}
          strokeWidth={1}
        />
        {mark ? (
          <SvgText
            x={chip.mark.x + size / 2}
            y={chip.mark.y + size / 2 + discR * 0.36}
            textAnchor="middle"
            fill={markInk ?? colors.cardInk}
            fontSize={discR * 0.95}>
            {mark}
          </SvgText>
        ) : null}
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
