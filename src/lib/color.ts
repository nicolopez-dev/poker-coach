/** Swatch luminance above which a chip counts as "light". */
export const LIGHT_CHIP = 0.62;

/** Relative luminance of a hex colour, 0–1 (0.299R + 0.587G + 0.114B). */
export function luminance(hex: string): number {
  const { r, g, b } = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function rgb(hex: string): { r: number; g: number; b: number } {
  const h = String(hex).replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(n.slice(0, 2), 16) || 0,
    g: parseInt(n.slice(2, 4), 16) || 0,
    b: parseInt(n.slice(4, 6), 16) || 0,
  };
}

export function isLightChip(swatch: string): boolean {
  return luminance(swatch) > LIGHT_CHIP;
}

/** Colour of the edge dashes around a chip. */
export function chipDash(swatch: string): string {
  return isLightChip(swatch) ? '#2b2b2b' : '#ffffff';
}

/** Ink for the value printed on a chip face. */
export function chipInk(swatch: string): string {
  return isLightChip(swatch) ? '#17181a' : '#ffffff';
}
