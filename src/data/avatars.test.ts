/**
 * Avatar ids are written into `profiles.avatar_id` and read back on every launch, so
 * they are data, not presentation. Renaming one silently orphans every profile that
 * picked it — these are the guards against doing that by accident.
 */

import { AVATARS, DEFAULT_AVATAR_ID, findAvatar } from './avatars';
import { colors } from '../theme/tokens';

describe('the avatar set', () => {
  it('offers between twelve and sixteen', () => {
    expect(AVATARS.length).toBeGreaterThanOrEqual(12);
    expect(AVATARS.length).toBeLessThanOrEqual(16);
  });

  it('gives every one a unique id', () => {
    const ids = AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The exact strings, spelled out. A test that recomputed them from the same arrays
   * the module builds them from would agree with any rename and catch nothing.
   */
  it('keeps the ids it has already handed out', () => {
    expect(AVATARS.map((a) => a.id).sort()).toEqual(
      [
        'club-felt', 'club-ink', 'club-night', 'club-table',
        'diamond-felt', 'diamond-ink', 'diamond-night', 'diamond-table',
        'heart-felt', 'heart-ink', 'heart-night', 'heart-table',
        'spade-felt', 'spade-ink', 'spade-night', 'spade-table',
      ].sort(),
    );
  });

  it('has a default that is actually in the set', () => {
    expect(findAvatar(DEFAULT_AVATAR_ID)).toBeDefined();
  });

  it('draws every one from the palette, never a loose hex', () => {
    const palette = new Set<string>(Object.values(colors) as string[]);
    for (const avatar of AVATARS) {
      expect(palette.has(avatar.fill)).toBe(true);
      expect(palette.has(avatar.ink)).toBe(true);
    }
  });

  /**
   * Red is the chip action, hearts, the "Playing" badge and chip focus rings. A ♥ tile
   * drawn in `colors.red` would be a fifth use, and the rule would stop meaning anything.
   */
  it('uses no red, not even for the red suits', () => {
    const reds = [colors.red, colors.crimson, colors.cardRed, colors.redSoft];
    for (const avatar of AVATARS) {
      expect(reds).not.toContain(avatar.ink);
      expect(reds).not.toContain(avatar.fill);
    }
  });

  it('shows all four suits', () => {
    expect(new Set(AVATARS.map((a) => a.glyph))).toEqual(new Set(['♠', '♥', '♦', '♣']));
  });
});

describe('findAvatar', () => {
  it('finds one that exists', () => {
    expect(findAvatar('spade-felt')?.glyph).toBe('♠');
  });

  it('returns nothing for an id the set has never had', () => {
    // an older build, or a row written before a rename — Avatar falls back to initials
    expect(findAvatar('spade-velvet')).toBeUndefined();
  });

  it('returns nothing for an unset avatar', () => {
    expect(findAvatar(null)).toBeUndefined();
    expect(findAvatar(undefined)).toBeUndefined();
    expect(findAvatar('')).toBeUndefined();
  });
});
