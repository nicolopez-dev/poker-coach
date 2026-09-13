/**
 * The chip's geometry, checked as a solid rather than as a picture.
 *
 * The whole point of projecting it by hand is that it behaves like a cylinder: face-on
 * you see a disc and no edge, edge-on you see the edge and no disc, and past a quarter
 * turn you are looking at the other side. Those are the three things a flat two-face
 * fallback gets wrong, so they are the three things pinned here.
 */
import { ease, geometry, restFrom, turnAt } from './RankChip';

const WHITE = { swatch: '#f4f1e6', dash: '#2b2b2b' };
const SIZE = 72;

/** Widest and tallest extent of a `points` string, as the SVG would draw it. */
function extent(points: string) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const pair of points.split(' ')) {
    const [x, y] = pair.split(',').map(Number);
    xs.push(x);
    ys.push(y);
  }
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

describe('face-on', () => {
  const chip = geometry(0, 0, SIZE, WHITE);

  it('shows no edge at all — a chip seen square has none', () => {
    expect(chip.facets).toHaveLength(0);
  });

  it('shows the face as a circle', () => {
    const { w, h } = extent(chip.face.points);
    expect(Math.abs(w - h)).toBeLessThan(0.5);
  });

  it('leaves the mark centred, and square in both directions', () => {
    expect(chip.mark.x).toBeCloseTo(0, 2);
    expect(chip.mark.scaleX).toBeCloseTo(chip.mark.scaleY, 5);
    // a shade over 1: the face is the near side of the chip, so perspective lifts it
    expect(chip.mark.scaleX).toBeGreaterThan(1);
    expect(chip.mark.scaleX).toBeLessThan(1.03);
  });
});

describe('turning', () => {
  it('opens the edge up as the face closes', () => {
    const little = geometry(0, 20, SIZE, WHITE);
    const lots = geometry(0, 60, SIZE, WHITE);

    expect(little.facets.length).toBeGreaterThan(0);
    expect(lots.facets.length).toBeGreaterThanOrEqual(little.facets.length);
    // the face narrows as it turns away, and all but only horizontally — the height
    // drifts by a fraction of a pixel as the face swings nearer to and further from
    // the camera, which is perspective doing its job
    expect(extent(lots.face.points).w).toBeLessThan(extent(little.face.points).w);
    expect(extent(lots.face.points).h).toBeCloseTo(extent(little.face.points).h, 0);
  });

  it('shows half the milling at a quarter turn, and no face worth the name', () => {
    const chip = geometry(0, 90, SIZE, WHITE);
    expect(chip.facets).toHaveLength(12);
    // the disc has collapsed to a line: this is the moment a two-face chip vanishes
    expect(extent(chip.face.points).w).toBeLessThan(1);
    expect(chip.mark.scaleX).toBeLessThan(0.02);
  });

  it('turns over past the quarter, and back again', () => {
    expect(geometry(0, 0, SIZE, WHITE).mark.front).toBe(true);
    expect(geometry(0, 89, SIZE, WHITE).mark.front).toBe(true);
    expect(geometry(0, 91, SIZE, WHITE).mark.front).toBe(false);
    expect(geometry(0, 180, SIZE, WHITE).mark.front).toBe(false);
    expect(geometry(0, -91, SIZE, WHITE).mark.front).toBe(false);
  });

  it('never draws a facet that is round the back', () => {
    for (let ry = -180; ry <= 180; ry += 15) {
      const n = geometry(-14, ry, SIZE, WHITE).facets.length;
      expect(`${ry}° → ${n <= 13}`).toBe(`${ry}° → true`);
    }
  });
});

describe('the mark printed on the face', () => {
  /** `matrix(a b c d e f)` — b and c are the terms that lean and shear it. */
  const M = (rx: number, ry: number) => geometry(rx, ry, SIZE, WHITE).mark.matrix;

  it('sits square when the chip does', () => {
    const [a, b, c, d] = M(0, 0);
    expect(b).toBeCloseTo(0, 6);
    expect(c).toBeCloseTo(0, 6);
    expect(a).toBeCloseTo(d, 6);
  });

  it('leans with a tilt rather than only shrinking', () => {
    // the bug this replaces: scale-only, so a chip tilted on both axes squashed the
    // glyph on the spot instead of laying it on the face
    const [, b, c] = M(-25, -35);
    expect(Math.abs(b) + Math.abs(c)).toBeGreaterThan(0.05);
  });

  it('turns further as the tilt grows', () => {
    const lean = (rx: number) => Math.abs(M(rx, -30)[1]);
    expect(lean(-30)).toBeGreaterThan(lean(-10));
    expect(lean(-10)).toBeGreaterThan(lean(0));
  });

  it('keeps the glyph the right way round on the back face', () => {
    // seen from behind, the face's x axis runs backwards; un-mirroring it is what stops
    // the spade reading as its own reflection
    const back = M(0, 180);
    expect(back[0]).toBeGreaterThan(0);
  });

  it('rides the face rather than the box, so it shifts as the chip turns', () => {
    const centred = M(0, 0);
    const turned = M(0, 55);
    expect(Math.abs(turned[4] - centred[4])).toBeGreaterThan(0.5);
  });

  it('collapses with the face at a quarter turn', () => {
    const [a, b] = M(0, 90);
    expect(Math.hypot(a, b)).toBeLessThan(0.02);
  });
});

describe('the chip stays in its box', () => {
  it('at every angle, so nothing clips the card it sits on', () => {
    for (let ry = -180; ry <= 180; ry += 15) {
      const chip = geometry(-14, ry, SIZE, WHITE);
      const points = [
        chip.face.points,
        ...chip.facets.map((f) => f.points),
        ...chip.mill.map((m) => m.points),
      ].join(' ');
      const all = points
        .split(' ')
        .filter(Boolean)
        .flatMap((p) => p.split(',').map(Number));
      const min = Math.min(...all);
      const max = Math.max(...all);
      expect(`${ry}° → ${min >= -0.5 && max <= SIZE + 0.5}`).toBe(`${ry}° → true`);
    }
  });
});

describe('the milled edge', () => {
  it('alternates, so the facets read as milling and not as a band', () => {
    const chip = geometry(-14, 55, SIZE, WHITE);
    const fills = new Set(chip.facets.map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(1);
  });

  it('is cut into the face as well, so a chip seen square still reads as one', () => {
    // the moment the edge disappears is the moment this has to carry the chip
    const chip = geometry(0, 0, SIZE, WHITE);
    expect(chip.facets).toHaveLength(0);
    expect(chip.mill).toHaveLength(12);
  });

  it('keeps the face dashes inside the outer ring, clear of the middle', () => {
    const chip = geometry(0, 0, SIZE, WHITE);
    const c = SIZE / 2;
    const inner = c * 0.92 - (7 / 72) * SIZE;

    for (const m of chip.mill) {
      for (const pair of m.points.split(' ')) {
        const [x, y] = pair.split(',').map(Number);
        const r = Math.hypot(x - c, y - c);
        // a shade of slack for the perspective lift on the near face
        expect(`${r.toFixed(1)} within the ring`).toBe(
          `${r.toFixed(1)} ${r >= inner - 0.5 && r <= c * 0.92 * 1.03 ? 'within the ring' : 'OUTSIDE'}`,
        );
      }
    }
  });

  it('shades each facet by how it meets the light', () => {
    // same colour, different angles round the rim → different greys
    const chip = geometry(0, 90, SIZE, WHITE);
    const dashes = chip.facets.filter((_, i) => i % 2 === 0).map((f) => f.fill);
    expect(new Set(dashes).size).toBeGreaterThan(1);
  });
});

describe('turning over, and settling back', () => {
  it('eases rather than jumps — a tap travels the whole half turn', () => {
    const from = { rx: -14, ry: -18 };
    const to = { rx: -14, ry: from.ry + 180 };

    // the bug this replaces: the angle was set outright, so there were no frames at all
    const seen = [0.25, 0.5, 0.75].map((t) => turnAt(from, to, t).ry);
    for (const ry of seen) {
      expect(`${ry.toFixed(1)} between`).toBe(
        `${ry.toFixed(1)} ${ry > from.ry && ry < to.ry ? 'between' : 'NOT between'}`,
      );
    }
    // and it only ever goes forwards
    expect(seen[0]).toBeLessThan(seen[1]);
    expect(seen[1]).toBeLessThan(seen[2]);
  });

  it('starts where it was and lands where it was sent', () => {
    const from = { rx: -30, ry: 120 };
    const to = { rx: -14, ry: 300 };
    expect(turnAt(from, to, 0)).toEqual(from);
    expect(turnAt(from, to, 1).rx).toBeCloseTo(to.rx, 6);
    expect(turnAt(from, to, 1).ry).toBeCloseTo(to.ry, 6);
  });

  it('slows into the finish, as the handoff’s easing does', () => {
    const first = ease(0.25) - ease(0);
    const last = ease(1) - ease(0.75);
    expect(first).toBeGreaterThan(last);
  });

  it('takes the short way home, even when that means going the other way round', () => {
    // 170° is 172° forward from rest and 188° back, so it carries on forwards and out
    // past the wrap rather than unwinding — an unwrapped target is what allows that
    expect(restFrom(170).ry).toBeCloseTo(342, 6);
    // 160° is 178° back, which is the shorter of the two
    expect(restFrom(160).ry).toBeCloseTo(-18, 6);
    // already home: nothing to travel
    expect(restFrom(-18).ry).toBeCloseTo(-18, 6);
  });

  it('never sends the chip more than half a turn to get home', () => {
    for (let ry = -180; ry <= 180; ry += 10) {
      const travel = Math.abs(restFrom(ry).ry - ry);
      expect(`${ry}° → ${travel <= 180.001}`).toBe(`${ry}° → true`);
    }
  });
});
