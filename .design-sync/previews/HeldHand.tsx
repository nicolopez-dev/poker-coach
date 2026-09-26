import { HeldHand } from 'poker-coach';

/**
 * The two hole cards, dealt in from the bottom of the question and fanned. Tapping opens
 * the pair out flat. `replayKey` changes deal a new hand and replay the intro.
 */
export const AceKingSuited = () => (
  <HeldHand
    hole={[
      { rank: 'A', suit: '♠' },
      { rank: 'K', suit: '♠' },
    ]}
    replayKey={0}
  />
);

/** A red pair. */
export const PocketQueens = () => (
  <HeldHand
    hole={[
      { rank: 'Q', suit: '♥' },
      { rank: 'Q', suit: '♦' },
    ]}
    replayKey={0}
  />
);
