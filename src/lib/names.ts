/** Longest seat name shown in full; anything longer collapses to initials. */
const FULL_NAME_LIMIT = 7;

/** Seat names are stored in full but capped, so a row never grows. */
export const NAME_MAX_LENGTH = 24;

/**
 * Collapses a seat name so the Balance row never wraps or grows:
 * "Marta Rodriguez" → "MR", "Bartholomew" → "BA", "Ana" → "Ana".
 * Shown on blur only — the field shows the full name while focused.
 */
export function shortName(name: string): string {
  const t = String(name ?? '').trim();
  if (!t) return '';
  if (t.length <= FULL_NAME_LIMIT) return t;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return parts
      .slice(0, 3)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
  return t.slice(0, 2).toUpperCase();
}
