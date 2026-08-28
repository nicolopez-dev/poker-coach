/**
 * Digits-only parse, clamped to 0..max — the prototype's `num()`.
 * Anything unparseable becomes 0, so a half-cleared field never reads NaN.
 */
export function digits(value: string | number, max: number): number {
  const n = parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
  return Math.max(0, Math.min(max, n));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
