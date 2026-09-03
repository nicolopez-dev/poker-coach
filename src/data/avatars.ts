/**
 * The built-in avatar set — no uploads, by design (§1).
 *
 * Four suits across four grounds already in the palette. Nothing new is invented here:
 * the grounds are the same four surfaces the cards and buttons use, and the ink follows
 * the rule the rest of the app follows — near-black grounds take gold, felt and table
 * grounds take the plain text colour.
 *
 * **No red.** Red belongs to the chip action, hearts, the "Playing" badge and the chip
 * tool's focus rings, so a ♥ avatar is drawn in the same ink as a ♠. Sixteen tiles that
 * differ only by ground would be dull; sixteen that quietly break the colour rule would
 * be worse.
 *
 * Ids are stable strings and are what `profiles.avatar_id` stores. Renaming one orphans
 * every profile that picked it, which is why `Avatar` falls back to initials rather than
 * rendering nothing.
 */

import { colors } from '../theme/tokens';

export type Avatar = {
  id: string;
  glyph: string;
  fill: string;
  ink: string;
};

const SUITS = [
  { key: 'spade', glyph: '♠' },
  { key: 'heart', glyph: '♥' },
  { key: 'diamond', glyph: '♦' },
  { key: 'club', glyph: '♣' },
] as const;

const GROUNDS = [
  { key: 'felt', fill: colors.greenDeep, ink: colors.text },
  { key: 'table', fill: colors.surface, ink: colors.text },
  { key: 'night', fill: colors.reward, ink: colors.gold },
  { key: 'ink', fill: colors.rewardAlt, ink: colors.gold },
] as const;

export const AVATARS: Avatar[] = GROUNDS.flatMap((ground) =>
  SUITS.map((suit) => ({
    id: `${suit.key}-${ground.key}`,
    glyph: suit.glyph,
    fill: ground.fill,
    ink: ground.ink,
  })),
);

/** What a new profile gets before anyone has chosen — the wordmark's own mark. */
export const DEFAULT_AVATAR_ID = 'spade-felt';

export function findAvatar(id: string | null | undefined): Avatar | undefined {
  return id ? AVATARS.find((avatar) => avatar.id === id) : undefined;
}
