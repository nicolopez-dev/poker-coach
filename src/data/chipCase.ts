import type { ChipColor } from '../lib/chips';

/** The case a new player starts with. */
export const DEFAULT_COLORS: ChipColor[] = [
  { name: 'White', swatch: '#f4f1e6', count: 40, value: 1 },
  { name: 'Red', swatch: '#ff7a63', count: 40, value: 5 },
  { name: 'Green', swatch: '#4a6b52', count: 40, value: 25 },
  { name: 'Blue', swatch: '#3a4f6b', count: 40, value: 50 },
  { name: 'Black', swatch: '#1a1a1a', count: 40, value: 100 },
];

/** Offered in order when the user adds a colour. */
export const SPARE_COLORS: { name: string; swatch: string }[] = [
  { name: 'Purple', swatch: '#6b4a7a' },
  { name: 'Orange', swatch: '#d97b2b' },
  { name: 'Grey', swatch: '#8a8a8a' },
  { name: 'Pink', swatch: '#c9628a' },
  { name: 'Teal', swatch: '#2f7d7a' },
  { name: 'Yellow', swatch: '#d8b23a' },
];

/** Every swatch the colour picker offers. */
export const SWATCHES: string[] = [
  ...DEFAULT_COLORS.map((c) => c.swatch),
  ...SPARE_COLORS.map((c) => c.swatch),
];

export const MIN_COLORS = 2;
export const MAX_COLORS = 8;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const MAX_CHIP_COUNT = 500;
export const MAX_CHIP_VALUE = 10000;
export const MAX_NAME_LENGTH = 14;
