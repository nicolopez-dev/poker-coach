/**
 * The chip's geometry, checked as a solid rather than as a picture.
 *
 * The whole point of projecting it by hand is that it behaves like a cylinder: face-on
 * you see a disc and no edge, edge-on you see the edge and no disc, and past a quarter
 * turn you are looking at the other side. Those are the three things a flat two-face
 * fallback gets wrong, so they are the three things pinned here.
 */
import { geometry } from './RankChip';

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
