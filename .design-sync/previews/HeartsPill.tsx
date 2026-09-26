import { HeartsPill, View } from 'poker-coach';

/** The next heart, eighteen minutes and forty seconds out. */
const nextHeart = new Date(Date.now() + (18 * 60 + 40) * 1000 + 500).toISOString();

/** Pills sit in a row in the header, sized to their content. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row' }}>{children}</View>
);

/** Full: five red hearts, nothing to wait for. */
export const Full = () => (
  <Row>
    <HeartsPill hearts={5} />
  </Row>
);

/** Below max: spent hearts go dark green and the wait for the next one ticks. */
export const Refilling = () => (
  <Row>
    <HeartsPill hearts={2} nextHeartAt={nextHeart} />
  </Row>
);

/** Out of hearts: every pip spent, still counting down. */
export const Empty = () => (
  <Row>
    <HeartsPill hearts={0} nextHeartAt={nextHeart} />
  </Row>
);

/** Before the server answers: a dash, never an empty row. */
export const Pending = () => (
  <Row>
    <HeartsPill hearts={0} pending />
  </Row>
);
