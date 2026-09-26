import { RedButton } from 'poker-coach';

const noop = () => {};

/**
 * The one primary chip action, in carmesí. There is one per screen at most — red is
 * reserved for this, hearts, the "Playing" badge and the chip tool's focus rings.
 */
export const DealTheStacks = () => <RedButton label="Deal the stacks" glyph="♦" onPress={noop} />;
