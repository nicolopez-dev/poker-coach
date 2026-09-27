import React, { useEffect, useId, useRef, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { rgb } from '../lib/color';
import { colors, font } from '../theme/tokens';

/**
 * The 2X XP chip — what taking the ante looks like.
 *
 * Ported from the design's `2x XP Chip.html` (the "Chips and cards alignment fixes"
 * project, played embedded in `Lesson Boost.dc.html`). The design builds it in three.js:
 * a black chip with six gold dashes, "2X / XP" in gold on both faces, lightning that
 * converges, then a drop, a spin that slows to face the player, and a lock.
 *
 * ## Why this is SVG and not WebGL
 *
 * The app carries no GL runtime, and animation here is deliberately dependency-free (see
 * `anim.tsx`). So this does what `RankChip` does: the chip is modelled as the cylinder it
 * is, projected by hand through the design's own camera, and every facet is shaded by how
 * it meets the light. The scene keeps the design's units — metres, a 39 mm chip — and its
 * camera, so the numbers below can be checked against the source line for line.
 *
 * What changed on the way:
 *
 *  · The environment map becomes a handful of light lobes standing where the design's
 *    softboxes stand. Same highlights, no reflections of the room.
 *  · The iframe's radial mask becomes a radial fade on every effect's paint, and an
 *    opacity on the chip while it is falling in from outside it. A real SVG mask would
 *    cost an offscreen bitmap per frame on Android.
 *  · Additive blending becomes ordinary alpha. On dark felt the two read the same.
 *  · Sparks are batched into a few paths by brightness rather than drawn one by one, and
 *    lightning likewise by how far it has faded — a few dozen elements a frame, not a
 *    few hundred.
 *  · The halo and core sprites are dropped: the design builds them but never adds them to
 *    the scene, so they were never on screen.
 *
 * It plays once from mount, then idles — bob, sway, a sheen every 2.4s, crackle round the
 * rim, gold dust rising — for as long as it is on screen. That is the design's `?embed`.
 *
 * `DoubleXpBadge`, at the bottom, is the same chip small and quiet for the header.
 */

// ─────────────────────────────────────────────────────────────── the scene

/** 39 mm across, 3.3 mm thick. */
const R = 0.0195;
const HALF = 0.0033 / 2;
/** where the gold dashes stop on the face */
const RI = R * 0.84;
/** the chip's rest height, which is also where the camera looks */
export const BASE_Y = R + 0.008;

/** The frame the design renders into — the iframe in `Lesson Boost`. */
export const FRAME = { width: 390, height: 440 } as const;

/**
 * The design's camera: 45° vertical field, framing the chip's bounding sphere (radius
 * 0.02764) at 1.35× — `three-d-stage.setObject` — then swung round to look at it almost
 * square on, a tenth up. Measured off the reference scene, not assumed.
 */
const CAM_DIST = 0.090094;
const CAM_DIR = { y: 0.1 / Math.hypot(0.1, 1), z: 1 / Math.hypot(0.1, 1) };
const CAM = { x: 0, y: BASE_Y + CAM_DIR.y * CAM_DIST, z: CAM_DIR.z * CAM_DIST };
const TAN_HALF_FOV = Math.tan((22.5 * Math.PI) / 180);

const TAU = Math.PI * 2;

// ─────────────────────────────────────────────────────────────── the timeline

/** The chip appears and starts to fall. */
export const FALL_AT = 0.45;
/** It lands: lightning out, sparks, shockwaves. */
export const IMPACT = 0.85;
/** The spin has run down and it faces the player. */
export const LOCK = 2.5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const outCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export type Pose = {
  /** the chip's centre height, in metres */
  y: number;
  /** Euler angles, applied X then Y then Z as three.js does */
  rx: number;
  ry: number;
  rz: number;
  /** overall size — 0 until it appears */
  s: number;
  /** the squash and stretch on top of it */
  sx: number;
  sy: number;
  /** how hard the gold glows, the design's `emissiveIntensity` */
  emissive: number;
  /** how far the world jolts at the landing */
  shake: number;
  /** where the sheen band is across the face, and how strong — 0 between sweeps */
  sheenOff: number;
  sheenAmt: number;
};

/** Where the chip is at `t` seconds — `pose()` in the design, less the loop's exit. */
export function poseAt(t: number): Pose {
  const fall = seg(t, FALL_AT, IMPACT);
  const spin = seg(t, IMPACT, LOCK);

  let y = BASE_Y + 0.09 * Math.pow(1 - fall, 2);
  const s = t < FALL_AT ? 0 : 0.6 + 0.4 * fall;
  let ry = t < IMPACT ? -TAU * (4 + 2 * fall) : -TAU * 4 * (1 - outCubic(spin));
  let rx = 0;
  const rz = t < IMPACT ? -0.4 * (1 - fall) : 0;
  let sx = 1;
  let sy = 1;

  if (t >= IMPACT) {
    const k = t - IMPACT;
    const squash = Math.exp(-k * 9) * Math.cos(k * 32);
    sy = 1 - 0.14 * squash;
    sx = 1 + 0.1 * squash;
    y -= 0.002 * Math.exp(-k * 10);
  }

  if (t > LOCK) {
    const k = t - LOCK;
    const settle = clamp01(k / 0.8);
    y += Math.sin(k * 2.2) * 0.0011 * settle;
    rx = (-0.14 + Math.sin(k * 1.6) * 0.07) * settle;
    ry += Math.sin(k * 1.15) * 0.16 * settle;
    const pop = Math.exp(-k * 7) * Math.sin(k * 20) * 0.05;
    sx += pop;
    sy += pop;
  }

  const sinceImpact = t - IMPACT;
  const sinceLock = t - LOCK;
  const impactF = sinceImpact > 0 ? Math.exp(-sinceImpact * 4) : 0;
  const lockF = sinceLock > 0 ? Math.exp(-sinceLock * 3.2) : 0;
  const breathe = sinceLock > 0 ? 0.5 + 0.5 * Math.sin(sinceLock * 2.4) : 0;
  // a sheen sweep at the lock, then every 2.4s
  const sweep = sinceLock > 0 ? (sinceLock % 2.4) / 0.9 : 9;

  return {
    y,
    rx,
    ry,
    rz,
    s,
    sx,
    sy,
    emissive: t > FALL_AT ? 0.55 * impactF + 0.45 * lockF + 0.15 + 0.06 * breathe : 0,
    shake: sinceImpact >= 0 ? Math.exp(-sinceImpact * 12) * 0.0016 : 0,
    sheenOff: -0.2 + sweep * 1.8,
    sheenAmt: sweep < 1 ? 0.75 : 0,
  };
}

// ─────────────────────────────────────────────────────────────── projection

type V3 = [number, number, number];
type P2 = [number, number];

type Camera = { cx: number; cy: number; focal: number; /** px per metre at the chip */ ppu: number };

function cameraFor(width: number, height: number): Camera {
  const focal = height / 2 / TAN_HALF_FOV;
  return { cx: width / 2, cy: height / 2, focal, ppu: focal / CAM_DIST };
}

/** World → screen, through the design's perspective camera. */
function project(cam: Camera, [x, y, z]: V3): P2 {
  const vx = x - CAM.x;
  const vy = y - CAM.y;
  const vz = z - CAM.z;
  const depth = -(vy * CAM_DIR.y + vz * CAM_DIR.z);
  const up = vy * CAM_DIR.z - vz * CAM_DIR.y;
  return [cam.cx + (vx / depth) * cam.focal, cam.cy - (up / depth) * cam.focal];
}

/** How far a point is from the camera, for sorting facets back to front. */
const distance = ([x, y, z]: V3) => Math.hypot(x - CAM.x, y - CAM.y, z - CAM.z);

const unit = (x: number, y: number, z: number): V3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The chip's placement for one frame: T · R · S, as `Object3D.matrix` composes it. */
type Placement = { m: number[]; scale: V3; at: V3 };

function placement(pose: Pose, shiftX: number, shiftY: number): Placement {
  const a = Math.cos(pose.rx);
  const b = Math.sin(pose.rx);
  const c = Math.cos(pose.ry);
  const d = Math.sin(pose.ry);
  const e = Math.cos(pose.rz);
  const f = Math.sin(pose.rz);
  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;
  // three.js `makeRotationFromEuler`, order XYZ
  const m = [c * e, -c * f, d, af + be * d, ae - bf * d, -b * c, bf - ae * d, be + af * d, a * c];
  const s = Math.max(pose.s, 1e-4);
  return {
    m,
    scale: [s * pose.sx, s * pose.sy, s * pose.sx],
    at: [shiftX, pose.y + shiftY, 0],
  };
}

function toWorld({ m, scale, at }: Placement, x: number, y: number, z: number): V3 {
  const sx = x * scale[0];
  const sy = y * scale[1];
  const sz = z * scale[2];
  return [
    at[0] + m[0] * sx + m[1] * sy + m[2] * sz,
    at[1] + m[3] * sx + m[4] * sy + m[5] * sz,
    at[2] + m[6] * sx + m[7] * sy + m[8] * sz,
  ];
}

/** A surface normal, carried through the inverse scale so the squash leans it properly. */
function normalToWorld({ m, scale }: Placement, x: number, y: number, z: number): V3 {
  const sx = x / scale[0];
  const sy = y / scale[1];
  const sz = z / scale[2];
  return unit(
    m[0] * sx + m[1] * sy + m[2] * sz,
    m[3] * sx + m[4] * sy + m[5] * sz,
    m[6] * sx + m[7] * sy + m[8] * sz,
  );
}

// ─────────────────────────────────────────────────────────────── light

type RGB = [number, number, number];

/**
 * Where the design's softboxes stand, as directions from the chip. The body is lit by
 * the first set (`ENV_DARK`), the gold by all of them (`ENV_GOLD`).
 */
const TOP = unit(0, 4.5, 3.5);
const LEFT = unit(-5, 0.5, 1.5);
const RIGHT = unit(5, 0.5, 1.5);
const KEY = unit(-3.5, 1, 5);

/** How a surface at `p` facing `n` meets the camera and the lights. */
function lightAt(n: V3, p: V3) {
  const v = unit(CAM.x - p[0], CAM.y - p[1], CAM.z - p[2]);
  const facing = Math.max(0, dot(n, v));
  // the direction the camera sees reflected in the surface
  const r: V3 = [2 * facing * n[0] - v[0], 2 * facing * n[1] - v[1], 2 * facing * n[2] - v[2]];
  return {
    facing,
    top: Math.max(0, dot(r, TOP)),
    side: Math.max(0, dot(r, LEFT), dot(r, RIGHT)),
    key: Math.max(0, dot(r, KEY)),
  };
}

/**
 * Polished gold under studio light, dark at a graze and cream face-on — read off the
 * reference renders rather than derived. `b` is brightness; the emissive flare adds to it.
 */
const GOLD_RAMP: [number, RGB][] = [
  [0.3, [70, 54, 26]],
  [0.55, [150, 118, 58]],
  [0.8, [214, 184, 112]],
  [1, [240, 224, 180]],
  [1.3, [255, 246, 222]],
];

function ramp(b: number): RGB {
  if (b <= GOLD_RAMP[0][0]) return GOLD_RAMP[0][1];
  for (let i = 1; i < GOLD_RAMP.length; i++) {
    const [at, c] = GOLD_RAMP[i];
    if (b <= at) {
      const [was, p] = GOLD_RAMP[i - 1];
      const k = (b - was) / (at - was);
      return [p[0] + (c[0] - p[0]) * k, p[1] + (c[1] - p[1]) * k, p[2] + (c[2] - p[2]) * k];
    }
  }
  return GOLD_RAMP[GOLD_RAMP.length - 1][1];
}

const css = ([r, g, b]: RGB) =>
  `rgb(${Math.round(Math.min(255, r))},${Math.round(Math.min(255, g))},${Math.round(Math.min(255, b))})`;

function goldFill(light: ReturnType<typeof lightAt>, emissive: number, rule = false): string {
  const b =
    0.42 +
    0.58 * Math.pow(light.facing, 0.7) +
    0.22 * Math.pow(light.top, 16) +
    0.25 * Math.pow(light.key, 12) +
    0.5 * emissive;
  // the dashes are the design's `gold_rule`, a step darker than the lettering
  return css(ramp(rule ? b * 0.94 : b));
}

const BODY = (() => {
  const { r, g, b } = rgb(colors.chipBlack);
  return [r, g, b] as RGB;
})();
const GLINT: RGB = [255, 241, 214];

/** Clearcoated black: stays black face-on, catches the strips at a graze. */
function bodyFill(light: ReturnType<typeof lightAt>): string {
  const fresnel = 0.1 + 0.9 * Math.pow(1 - light.facing, 3);
  const base = 0.8 + 0.3 * light.facing;
  const glint = (0.55 * Math.pow(light.side, 14) + 0.45 * Math.pow(light.top, 18)) * fresnel;
  return css([
    BODY[0] * base + GLINT[0] * glint * 0.5,
    BODY[1] * base + GLINT[1] * glint * 0.5,
    BODY[2] * base + GLINT[2] * glint * 0.5,
  ]);
}

// ─────────────────────────────────────────────────────────────── the chip's drawing

/** Six gold dashes round the edge, each 42% of its sixth. */
const DASHES = 6;
const SIXTH = TAU / DASHES;
const DASH = SIXTH * 0.42;

/** The milled edge as facets: three to a dash, four to the black between. */
const FACETS: { u0: number; u1: number; gold: boolean }[] = [];
for (let i = 0; i < DASHES; i++) {
  const a = i * SIXTH;
  for (let j = 0; j < 3; j++) FACETS.push({ u0: a + (DASH * j) / 3, u1: a + (DASH * (j + 1)) / 3, gold: true });
  const gap = SIXTH - DASH;
  for (let j = 0; j < 4; j++) {
    FACETS.push({ u0: a + DASH + (gap * j) / 4, u1: a + DASH + (gap * (j + 1)) / 4, gold: false });
  }
}

const FACE_POINTS = 64;
/** the inset ring, 70.5–74.5% of the radius */
const RING_IN = 0.705;
const RING_OUT = 0.745;

/**
 * The lettering, in face units of 100 to the radius — text at a size below 1 does not
 * survive every platform's glyph cache, so the matrix carries the scale instead.
 *
 * Sizes are the design's: "2X" is 9.2 mm of Archivo ExtraBold cap height sitting on a
 * baseline 2.1 mm below centre, "XP" 4.2 mm on one 7.9 mm below, letter-spaced by
 * 0.35 × the tracking it asks for. Archivo's cap height is 0.686 em.
 */
const FACE_UNIT = 100;
const LETTERS = [
  { text: '2X', size: 67.5, spacing: 3.3, baseline: 10.8 },
  { text: 'XP', size: 31.4, spacing: 2.85, baseline: 40.5 },
] as const;

const fixed = (n: number) => n.toFixed(1);
const polygon = (points: P2[]) =>
  `M${points.map(([x, y]) => `${fixed(x)},${fixed(y)}`).join('L')}Z`;

type ChipDrawing = {
  opacity: number;
  facets: { key: number; d: string; fill: string }[];
  face: string;
  faceFill: string;
  dashes: string;
  dashFill: string;
  ring: string;
  gold: string;
  /** `matrix(a b c d e f)` taking face units onto the screen */
  letters: string;
  sheen: { d: string; opacity: number }[];
};

/** The sheen's direction across a face, from `vUv.x*0.75 + vUv.y*0.65` in the shader. */
const SHEEN_DIR: P2 = [0.375 / Math.hypot(0.375, 0.325), 0.325 / Math.hypot(0.375, 0.325)];
/** how far one unit of radius moves the shader's band coordinate */
const SHEEN_RATE = Math.hypot(0.375, 0.325);

/**
 * The part of a unit disc between `a` and `b` along the sheen's direction, as points in
 * the face's own x-right, y-up coordinates.
 */
function band(a: number, b: number, rho: number): P2[] {
  const lo = Math.max(a, -rho);
  const hi = Math.min(b, rho);
  if (hi <= lo) return [];
  const from = Math.acos(hi / rho);
  const to = Math.acos(lo / rho);
  const [dx, dy] = SHEEN_DIR;
  const at = (phi: number): P2 => [
    rho * (Math.cos(phi) * dx - Math.sin(phi) * dy),
    rho * (Math.cos(phi) * dy + Math.sin(phi) * dx),
  ];
  const points: P2[] = [];
  for (let i = 0; i <= 6; i++) points.push(at(from + ((to - from) * i) / 6));
  for (let i = 0; i <= 6; i++) points.push(at(-to + ((to - from) * i) / 6));
  return points;
}

/**
 * The sheen as three nested bands whose stacked opacities trace the shader's
 * `smoothstep(0.14, 0, d)` — 0.14 at its fringe, 0.5 halfway, 0.87 at the core.
 */
function sheenBands(amount: number): { half: number; opacity: number }[] {
  const o1 = 0.14 * amount;
  const o2 = 1 - (1 - 0.5 * amount) / (1 - o1);
  const o3 = 1 - (1 - 0.87 * amount) / ((1 - o1) * (1 - o2));
  return [
    { half: 0.24, opacity: o1 },
    { half: 0.155, opacity: o2 },
    { half: 0.075, opacity: o3 },
  ];
}

function drawChip(cam: Camera, pose: Pose, shiftX: number, shiftY: number): ChipDrawing | null {
  if (pose.s < 0.01) return null;
  const at = placement(pose, shiftX, shiftY);
  const point = (x: number, y: number, z: number) => project(cam, toWorld(at, x, y, z));

  // Painted back to front: the facets of the edge that face the camera, farthest first.
  const facets = FACETS.map((f, key) => {
    const um = (f.u0 + f.u1) / 2;
    const centre = toWorld(at, R * Math.cos(um), R * Math.sin(um), 0);
    const n = normalToWorld(at, Math.cos(um), Math.sin(um), 0);
    const toCamera: V3 = [CAM.x - centre[0], CAM.y - centre[1], CAM.z - centre[2]];
    return { f, key, centre, n, visible: dot(n, toCamera) > 0 };
  })
    .filter((f) => f.visible)
    .sort((p, q) => distance(q.centre) - distance(p.centre))
    .map(({ f, key, centre, n }) => {
      const light = lightAt(n, centre);
      const c0 = Math.cos(f.u0);
      const s0 = Math.sin(f.u0);
      const c1 = Math.cos(f.u1);
      const s1 = Math.sin(f.u1);
      return {
        key,
        d: polygon([
          point(R * c0, R * s0, -HALF),
          point(R * c0, R * s0, HALF),
          point(R * c1, R * s1, HALF),
          point(R * c1, R * s1, -HALF),
        ]),
        fill: f.gold ? goldFill(light, pose.emissive, true) : bodyFill(light),
      };
    });

  // The face turned to the camera — the front at +z, the back at −z.
  const frontCentre = toWorld(at, 0, 0, HALF);
  const frontNormal = normalToWorld(at, 0, 0, 1);
  const front =
    dot(frontNormal, [CAM.x - frontCentre[0], CAM.y - frontCentre[1], CAM.z - frontCentre[2]]) > 0;
  const z = front ? HALF : -HALF;
  const faceNormal: V3 = front ? frontNormal : [-frontNormal[0], -frontNormal[1], -frontNormal[2]];
  const faceLight = lightAt(faceNormal, toWorld(at, 0, 0, z));

  const loop = (radius: number, reverse = false) => {
    const points: P2[] = [];
    for (let i = 0; i < FACE_POINTS; i++) {
      const u = ((reverse ? FACE_POINTS - i : i) / FACE_POINTS) * TAU;
      points.push(point(radius * Math.cos(u), radius * Math.sin(u), z));
    }
    return polygon(points);
  };

  // The dashes run through the chip, so they show on the face as well as the edge.
  const dashes = Array.from({ length: DASHES }, (_, i) => {
    const arc = [0, 1, 2, 3].map((j) => i * SIXTH + (DASH * j) / 3);
    const outer = arc.map((u) => point(R * Math.cos(u), R * Math.sin(u), z));
    const inner = [...arc].reverse().map((u) => point(RI * Math.cos(u), RI * Math.sin(u), z));
    return polygon([...outer, ...inner]);
  }).join('');

  // The back face is seen from behind, so its x runs the other way — the design turns
  // that face's lettering about z for the same reason, and it reads the right way round.
  const hand = front ? 1 : -1;
  const faceUnit = (u: number, w: number) => point((hand * u * R) / FACE_UNIT, (-w * R) / FACE_UNIT, z);
  const centre = faceUnit(0, 0);
  const alongU = faceUnit(FACE_UNIT, 0);
  const alongW = faceUnit(0, FACE_UNIT);
  const letters = [
    (alongU[0] - centre[0]) / FACE_UNIT,
    (alongU[1] - centre[1]) / FACE_UNIT,
    (alongW[0] - centre[0]) / FACE_UNIT,
    (alongW[1] - centre[1]) / FACE_UNIT,
    centre[0],
    centre[1],
  ];

  // The sheen rides a disc just proud of the face, 99.5% of its size.
  const sheen: ChipDrawing['sheen'] = [];
  if (pose.sheenAmt > 0) {
    const zs = front ? HALF + 0.00045 : -HALF - 0.00045;
    const middle = (pose.sheenOff - 0.7) / SHEEN_RATE;
    for (const { half, opacity } of sheenBands(pose.sheenAmt)) {
      const points = band(middle - half, middle + half, 1);
      if (points.length === 0 || opacity <= 0) continue;
      const rr = R * 0.995;
      sheen.push({
        d: polygon(points.map(([x, y]) => point(hand * x * rr, y * rr, zs))),
        opacity,
      });
    }
  }

  // Falling in from above, the chip passes through the design's mask; this stands in
  // for it, fading the chip by where its centre is against the same ellipse.
  const [px, py] = point(0, 0, 0);
  const reach = Math.hypot((px - cam.cx) / cam.cx, (py - cam.cy) / cam.cy);
  const opacity = reach <= 0.55 ? 1 : clamp01(1 - (reach - 0.55) / 0.45);

  return {
    opacity,
    facets,
    face: loop(R),
    faceFill: bodyFill(faceLight),
    dashes,
    dashFill: goldFill(faceLight, pose.emissive, true),
    ring: loop(R * RING_OUT) + loop(R * RING_IN, true),
    gold: goldFill(faceLight, pose.emissive),
    letters: `matrix(${letters.map((n) => n.toFixed(4)).join(' ')})`,
    sheen,
  };
}

// ─────────────────────────────────────────────────────────────── lightning

/** points along a bolt — the design's 33 */
const NP = 33;
const POOL = 40;

type Bolt = {
  make: () => V3[];
  life: number;
  age: number;
  width: number;
  taper: boolean;
};

/** Midpoint displacement between two points: the jag of a bolt, redrawn every frame. */
function fractal(a: V3, b: V3, rough: number): V3[] {
  const pts: V3[] = new Array(NP);
  pts[0] = [...a];
  pts[NP - 1] = [...b];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const split = (i: number, j: number, amp: number) => {
    if (j - i < 2) return;
    const m = (i + j) >> 1;
    const p = pts[i];
    const q = pts[j];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    const off = (Math.random() - 0.5) * amp;
    pts[m] = [
      (p[0] + q[0]) / 2 + (-dy / l) * off,
      (p[1] + q[1]) / 2 + (dx / l) * off,
      (p[2] + q[2]) / 2 + (Math.random() - 0.5) * amp * 0.3,
    ];
    split(i, m, amp * 0.55);
    split(m, j, amp * 0.55);
  };
  split(0, NP - 1, length * rough);
  return pts;
}

/** A crackle that runs round the rim rather than away from it. */
function arcPath(r: number, a0: number, a1: number, jitter: number): V3[] {
  return Array.from({ length: NP }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (NP - 1);
    const rr = r + (Math.random() - 0.5) * jitter * Math.sin((Math.PI * i) / (NP - 1));
    return [Math.cos(a) * rr, BASE_Y + Math.sin(a) * rr, 0.002 + (Math.random() - 0.5) * jitter * 0.3];
  });
}

const radial = (angle: number, r0: number, r1: number) => () =>
  fractal(
    [Math.cos(angle) * r0, BASE_Y + Math.sin(angle) * r0, 0.001],
    [Math.cos(angle) * r1, BASE_Y + Math.sin(angle) * r1, rand(-0.004, 0.004)],
    0.28,
  );

const inward = (angle: number, r0: number) => () =>
  fractal(
    [Math.cos(angle) * r0, BASE_Y + Math.sin(angle) * r0, -0.002],
    [0, BASE_Y, 0],
    0.3,
  );

// ─────────────────────────────────────────────────────────────── the simulation

const SPARKS = 500;

/**
 * Everything that happens over time and is not the chip's pose: the lightning pool, the
 * sparks, the shockwaves, and which of the timeline's moments have fired. Mutable on
 * purpose — it is advanced once a frame and read into a drawing.
 */
function createScene() {
  const bolts: Bolt[] = Array.from({ length: POOL }, () => ({
    make: () => [],
    life: 0,
    age: 1,
    width: 0,
    taper: true,
  }));

  const sp = {
    pos: new Float32Array(SPARKS * 3),
    vel: new Float32Array(SPARKS * 3),
    life: new Float32Array(SPARKS),
    age: new Float32Array(SPARKS).fill(9),
    drag: new Float32Array(SPARKS),
    grav: new Float32Array(SPARKS),
    hue: new Float32Array(SPARKS),
  };
  let next = 0;

  const waves = [0, 1, 2].map(() => ({ t0: -9, dur: 1, max: 0.1 }));
  const fired = new Set<string>();
  let nextCrackle = 0;

  function spawn(
    make: () => V3[],
    { life = 0.3, width = 0.0006, taper = true, branch = 0 } = {},
  ) {
    const bolt = bolts.find((b) => b.age >= b.life);
    if (!bolt) return;
    Object.assign(bolt, { make, life, width, taper, age: 0 });
    for (let k = 0; k < branch; k++) {
      const src = make();
      const p = src[8 + Math.floor(Math.random() * 16)];
      const a = src[0];
      const b = src[NP - 1];
      const turn = rand(-0.9, 0.9);
      const [dx, dy, dz] = unit(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * rand(0.25, 0.45);
      const end: V3 = [
        p[0] + (dx * Math.cos(turn) - dy * Math.sin(turn)) * len,
        p[1] + (dx * Math.sin(turn) + dy * Math.cos(turn)) * len,
        p[2] + dz * len,
      ];
      spawn(() => fractal(p, end, 0.3), { life: life * 0.8, width: width * 0.5, taper });
    }
  }

  function emit(n: number, fill: (i: number) => void) {
    for (let k = 0; k < n; k++) {
      fill(next);
      next = (next + 1) % SPARKS;
    }
  }

  function burst(n: number, speed: number) {
    emit(n, (i) => {
      const a = Math.random() * TAU;
      const s = speed * rand(0.25, 1);
      const r = R * rand(0.7, 1.05);
      sp.pos.set([Math.cos(a) * r, BASE_Y + Math.sin(a) * r, rand(-0.003, 0.006)], i * 3);
      sp.vel.set([Math.cos(a) * s, Math.sin(a) * s + 0.03, rand(-0.3, 0.6) * s], i * 3);
      sp.life[i] = rand(0.5, 1.4);
      sp.age[i] = 0;
      sp.drag[i] = rand(1.8, 3.2);
      sp.grav[i] = -0.18;
      sp.hue[i] = Math.random();
    });
  }

  function dust(n: number) {
    emit(n, (i) => {
      const a = Math.random() * TAU;
      const r = R * rand(1.05, 1.7);
      sp.pos.set([Math.cos(a) * r, BASE_Y + Math.sin(a) * r, rand(-0.01, 0.01)], i * 3);
      sp.vel.set([rand(-0.003, 0.003), rand(0.006, 0.016), 0], i * 3);
      sp.life[i] = rand(1.2, 2.4);
      sp.age[i] = 0;
      sp.drag[i] = 0.2;
      sp.grav[i] = 0;
      sp.hue[i] = 0.4 + Math.random() * 0.6;
    });
  }

  const once = (key: string, t: number, at: number, run: () => void) => {
    if (t >= at && !fired.has(key)) {
      fired.add(key);
      run();
    }
  };

  /** The timeline's moments — `events()` in the design, played once rather than looped. */
  function events(t: number) {
    // charge: bolts converge on where the chip will land
    for (let k = 0; k < 6; k++) {
      once(`c${k}`, t, 0.05 + k * 0.1, () =>
        spawn(inward(rand(0, TAU), R * rand(2.4, 3.2)), { life: 0.16, width: 0.00035, branch: 1 }),
      );
    }
    once('impact', t, IMPACT, () => {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU + rand(-0.2, 0.2);
        spawn(radial(a, R * 0.95, R * rand(2.6, 3.6)), {
          life: rand(0.35, 0.55),
          width: 0.00075,
          branch: 2,
        });
      }
      burst(260, 0.32);
      Object.assign(waves[0], { t0: t, dur: 0.7, max: 0.045 });
      Object.assign(waves[1], { t0: t + 0.08, dur: 1.0, max: 0.032 });
    });
    once('after', t, IMPACT + 0.22, () => {
      for (let k = 0; k < 5; k++) {
        spawn(radial(rand(0, TAU), R, R * rand(2, 2.8)), { life: 0.3, width: 0.0005, branch: 1 });
      }
    });
    once('lock', t, LOCK, () => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.26;
        spawn(radial(a, R, R * rand(1.9, 2.4)), { life: 0.3, width: 0.0005, branch: 1 });
      }
      for (let k = 0; k < 3; k++) {
        const a0 = rand(0, TAU);
        spawn(() => arcPath(R * 1.06, a0, a0 + rand(1, 1.8), R * 0.12), {
          life: 0.4,
          width: 0.0004,
          taper: false,
        });
      }
      burst(90, 0.14);
      Object.assign(waves[2], { t0: t, dur: 0.9, max: 0.028 });
    });
    // and then idle crackle round the rim, for as long as it is on screen
    if (t > LOCK + 0.4 && t >= nextCrackle) {
      nextCrackle = t + rand(0.35, 0.9);
      const a0 = rand(0, TAU);
      spawn(() => arcPath(R * rand(1.03, 1.1), a0, a0 + rand(0.6, 1.6), R * 0.14), {
        life: rand(0.15, 0.3),
        width: 0.00032,
        taper: false,
      });
      if (Math.random() < 0.35) {
        spawn(radial(rand(0, TAU), R, R * rand(1.6, 2.2)), { life: 0.18, width: 0.0003, branch: 1 });
      }
    }
  }

  function advance(t: number, dt: number) {
    events(t);
    if (t > LOCK + 0.3 && Math.random() < dt * 14) dust(1);

    for (const b of bolts) if (b.age < b.life) b.age += dt;

    for (let i = 0; i < SPARKS; i++) {
      if (sp.age[i] >= sp.life[i]) continue;
      const o = i * 3;
      sp.age[i] += dt;
      const d = Math.exp(-sp.drag[i] * dt);
      sp.vel[o] *= d;
      sp.vel[o + 1] = sp.vel[o + 1] * d + sp.grav[i] * dt;
      sp.vel[o + 2] *= d;
      sp.pos[o] += sp.vel[o] * dt;
      sp.pos[o + 1] += sp.vel[o + 1] * dt;
      sp.pos[o + 2] += sp.vel[o + 2] * dt;
    }
  }

  return { bolts, sp, waves, advance };
}

type Scene = ReturnType<typeof createScene>;

// ─────────────────────────────────────────────────────────────── one frame

/** Lightning's three strokes — the white core and two gold glows round it. */
const BOLT_LAYERS = [
  { k: 11, opacity: 0.13, paint: 'rule' },
  { k: 4.5, opacity: 0.35, paint: 'gold' },
  { k: 1, opacity: 1, paint: 'white' },
] as const;

/** How finely fades are bucketed so that a frame is a handful of paths. */
const LEVELS = 4;

type Paint = 'white' | 'gold' | 'rule' | 'light';

type Drawing = {
  waves: { key: number; cx: number; cy: number; r: number; width: number; opacity: number }[];
  chip: ChipDrawing | null;
  bolts: { key: string; d: string; opacity: number; paint: Paint }[];
  sparks: { key: string; d: string; opacity: number; paint: Paint; width: number }[];
};

function draw(scene: Scene, cam: Camera, t: number): Drawing {
  const pose = poseAt(t);
  const shiftX = (Math.random() - 0.5) * pose.shake;
  const shiftY = (Math.random() - 0.5) * pose.shake;
  const shifted = (p: V3): V3 => [p[0] + shiftX, p[1] + shiftY, p[2]];

  const waves: Drawing['waves'] = [];
  scene.waves.forEach((w, key) => {
    const p = seg(t, w.t0, w.t0 + w.dur);
    if (t < w.t0 || p >= 1) return;
    const [cx, cy] = project(cam, shifted([0, BASE_Y, -0.002]));
    const outer = (R + outExpo(p) * w.max) * (cam.focal / (CAM_DIST + 0.002));
    // RingGeometry(0.96, 1): a band 4% of the radius wide
    waves.push({ key, cx, cy, r: outer * 0.98, width: outer * 0.04, opacity: 0.8 * Math.pow(1 - p, 2) });
  });

  // Every live bolt, bucketed by layer and by how far it has faded.
  const boltPaths = new Map<string, { d: string[]; opacity: number; paint: Paint }>();
  for (const b of scene.bolts) {
    if (b.age >= b.life) continue;
    const flicker = 0.55 + 0.45 * Math.random();
    const fade = Math.pow(1 - b.age / b.life, 1.4) * flicker;
    const level = Math.ceil(fade * LEVELS) / LEVELS;
    if (level <= 0) continue;
    const pts = b.make().map((p) => project(cam, shifted(p)));
    for (const layer of BOLT_LAYERS) {
      const left: P2[] = [];
      const right: P2[] = [];
      for (let i = 0; i < NP; i++) {
        const [x, y] = pts[i];
        const q = pts[Math.min(i + 1, NP - 1)];
        const o = pts[Math.max(i - 1, 0)];
        const tx = q[0] - o[0];
        const ty = q[1] - o[1];
        const l = Math.hypot(tx, ty) || 1;
        const u = i / (NP - 1);
        const w =
          b.width * layer.k * cam.ppu * (b.taper ? 1 - 0.75 * u : Math.sin(Math.PI * u) * 0.9 + 0.1);
        const nx = (-ty / l) * w;
        const ny = (tx / l) * w;
        left.push([x + nx, y + ny]);
        right.push([x - nx, y - ny]);
      }
      const key = `${layer.paint}${level}`;
      const path = boltPaths.get(key) ?? { d: [], opacity: layer.opacity * level, paint: layer.paint };
      path.d.push(polygon([...left, ...right.reverse()]));
      boltPaths.set(key, path);
    }
  }
  // glows under cores, whatever order the buckets filled in
  const order: Paint[] = ['rule', 'gold', 'white', 'light'];
  const bolts = [...boltPaths.entries()]
    .sort(([, a], [, b]) => order.indexOf(a.paint) - order.indexOf(b.paint))
    .map(([key, p]) => ({ key, d: p.d.join(''), opacity: p.opacity, paint: p.paint }));

  // Sparks: hot white early, gold after, bucketed the same way. Each is a soft glow round
  // a bright point, as the design's sprite texture draws it.
  const sprite = 0.0028 * cam.ppu;
  const sparkPaths = new Map<string, { d: string[]; level: number; paint: Paint }>();
  const { sp } = scene;
  for (let i = 0; i < SPARKS; i++) {
    if (sp.age[i] >= sp.life[i]) continue;
    const u = sp.age[i] / sp.life[i];
    const f = Math.pow(1 - u, 1.5) * (sp.grav[i] === 0 ? Math.sin(Math.PI * u) : 1);
    const level = Math.ceil(f * LEVELS) / LEVELS;
    if (f < 0.02) continue;
    const hot = Math.max(0, 1 - u * 2.5) * (1 - sp.hue[i]) > 0.5;
    const o = i * 3;
    const [x, y] = project(cam, shifted([sp.pos[o], sp.pos[o + 1], sp.pos[o + 2]]));
    const key = `${hot ? 'w' : 'g'}${level}`;
    const path = sparkPaths.get(key) ?? { d: [], level, paint: hot ? 'white' : 'gold' };
    path.d.push(`M${fixed(x)},${fixed(y)}h0.1`);
    sparkPaths.set(key, path);
  }
  const sparks: Drawing['sparks'] = [];
  for (const [key, p] of sparkPaths) {
    const d = p.d.join('');
    sparks.push({ key: `${key}g`, d, opacity: 0.22 * p.level, paint: p.paint, width: sprite * 0.45 });
    sparks.push({ key: `${key}c`, d, opacity: p.level, paint: p.paint, width: sprite * 0.18 });
  }

  return { waves, chip: drawChip(cam, pose, shiftX, shiftY), bolts, sparks };
}

// ─────────────────────────────────────────────────────────────── the components

/** The chip itself, as `drawChip` laid it out — shared by the celebration and the badge. */
function ChipArt({ chip }: { chip: ChipDrawing }) {
  return (
    <G opacity={chip.opacity}>
      {chip.facets.map((f) => (
        <Path key={f.key} d={f.d} fill={f.fill} />
      ))}
      <Path d={chip.face} fill={chip.faceFill} />
      <Path d={chip.dashes} fill={chip.dashFill} />
      <Path d={chip.ring} fill={chip.gold} fillRule="evenodd" />
      <G transform={chip.letters}>
        {LETTERS.map((l) => (
          <SvgText
            key={l.text}
            // CSS-style tracking trails the last glyph too; half of it back recentres
            x={l.spacing / 2}
            y={l.baseline}
            textAnchor="middle"
            fontFamily={font.bold}
            fontSize={l.size}
            letterSpacing={l.spacing}
            fill={chip.gold}>
            {l.text}
          </SvgText>
        ))}
      </G>
      {chip.sheen.map((s, i) => (
        <Path key={i} d={s.d} fill="rgb(255,240,199)" opacity={s.opacity} />
      ))}
    </G>
  );
}

/**
 * The badge's turn: the rank chip's idle cadence — a step every 55ms — at 2° a step, so
 * a full turn takes about ten seconds. Slow enough to read "2X" most of the way round.
 */
const BADGE_STEP_MS = 55;
const BADGE_STEP = (2 * Math.PI) / 180;
/** the lock's lean, held — enough of the milled edge to read as a chip, not a coin */
const BADGE_TILT = -0.14;
/** how much of the box the chip's face fills, leaving the edge room when it turns */
const BADGE_FILL = 0.9;

/**
 * The same chip, small and quiet: no lightning, no sparks, only a slow turn in place. It
 * stands in for the header's ♠ mark while the ante runs, so a player can see from any tab
 * that the double is on.
 */
export function DoubleXpBadge({ size }: { size: number }) {
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTurn((a) => (a + BADGE_STEP) % TAU), BADGE_STEP_MS);
    return () => clearInterval(id);
  }, []);

  const ppu = (size * BADGE_FILL) / (2 * R);
  const cam: Camera = { cx: size / 2, cy: size / 2, focal: ppu * CAM_DIST, ppu };
  const chip = drawChip(
    cam,
    {
      y: BASE_Y,
      rx: BADGE_TILT,
      ry: turn,
      rz: 0,
      s: 1,
      sx: 1,
      sy: 1,
      // the design's resting glow, without the breathing — at this size it only flickers
      emissive: 0.18,
      shake: 0,
      sheenOff: 0,
      sheenAmt: 0,
    },
    0,
    0,
  );

  return (
    <Svg width={size} height={size}>
      {chip && <ChipArt chip={chip} />}
    </Svg>
  );
}

const PAINTS: Record<Paint, string> = {
  white: '#ffffff',
  gold: colors.gold,
  rule: colors.goldRule,
  light: colors.goldLight,
};

/** Past the landing and the lock, idle motion is slow enough to draw at half rate. */
const IDLE_AFTER = LOCK + 1;
const IDLE_FRAME_MS = 32;

export function DoubleXpChip({
  width,
  scale = Math.min(1, width / FRAME.width),
  style,
}: {
  /** the frame's width — wider than the design's 390 only gives the effects more room */
  width: number;
  /** the chip's size against the design's; the frame is 440 tall at 1 */
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const height = FRAME.height * scale;
  const id = useId().replace(/[^A-Za-z0-9]/g, '');

  const cam = useRef(cameraFor(width, height));
  cam.current = cameraFor(width, height);

  const [drawing, setDrawing] = useState<Drawing | null>(null);

  useEffect(() => {
    const scene = createScene();
    const began = Date.now();
    let last = began;
    let drawn = 0;
    let raf = 0;

    const tick = () => {
      const now = Date.now();
      const t = (now - began) / 1000;
      if (t > IDLE_AFTER && now - drawn < IDLE_FRAME_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      // a frame dropped by a busy thread must not fling the sparks across the screen
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drawn = now;
      scene.advance(t, dt);
      setDrawing(draw(scene, cam.current, t));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The design's mask: effects fade out from 55% of the way to the frame's edge.
  const fade = Math.min(width, height) / 2;
  const paint = (p: Paint) => `url(#${id}${p})`;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="A 2X XP chip lands in a burst of lightning"
      style={[{ width, height, pointerEvents: 'none' }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          {(Object.keys(PAINTS) as Paint[]).map((p) => (
            <RadialGradient
              key={p}
              id={`${id}${p}`}
              gradientUnits="userSpaceOnUse"
              cx={width / 2}
              cy={height / 2}
              r={fade}
              fx={width / 2}
              fy={height / 2}>
              <Stop offset="0" stopColor={PAINTS[p]} stopOpacity={1} />
              <Stop offset="0.55" stopColor={PAINTS[p]} stopOpacity={1} />
              <Stop offset="1" stopColor={PAINTS[p]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        {drawing?.waves.map((w) => (
          <Circle
            key={w.key}
            cx={w.cx}
            cy={w.cy}
            r={w.r}
            fill="none"
            stroke={paint('light')}
            strokeWidth={w.width}
            opacity={w.opacity}
          />
        ))}

        {drawing?.chip && <ChipArt chip={drawing.chip} />}

        {drawing?.bolts.map((b) => (
          <Path key={b.key} d={b.d} fill={paint(b.paint)} opacity={b.opacity} />
        ))}

        {drawing?.sparks.map((s) => (
          <Path
            key={s.key}
            d={s.d}
            fill="none"
            stroke={paint(s.paint)}
            strokeWidth={s.width}
            strokeLinecap="round"
            opacity={s.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}
