import { Glow, RedButton, RewardButton } from 'poker-coach';

const noop = () => {};

/**
 * `glow` — a 2.6s pulsing ring behind a pill button (a ring, since RN cannot animate
 * shadows). RewardButton's `glow` prop is this; wrap other pills directly.
 */
export const BehindAPill = () => (
  <Glow>
    <RedButton label="Deal the stacks" glyph="♦" onPress={noop} />
  </Glow>
);

/** Via the prop. */
export const RewardButtonGlow = () => <RewardButton label="Deal me in" glyph="♠" onPress={noop} glow />;
