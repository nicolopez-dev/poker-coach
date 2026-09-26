import { StreakPill, View } from 'poker-coach';

/** Local midnight, three hours and twenty minutes out. */
const midnight = new Date(Date.now() + (3 * 60 + 20) * 60_000 + 30_000).toISOString();

/** Pills sit in a row in the header, sized to their content. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row' }}>{children}</View>
);

/** A live run: the gold frame. */
export const Alive = () => (
  <Row>
    <StreakPill streak={12} />
  </Row>
);

/** One day from losing it: the frame goes hollow and the time left shows. No red. */
export const AtRisk = () => (
  <Row>
    <StreakPill streak={12} atRisk expiresAt={midnight} />
  </Row>
);

/** The run ended: a muted zero, no frame. */
export const Lapsed = () => (
  <Row>
    <StreakPill streak={0} />
  </Row>
);

/** Before the server answers: a dash, never a zero. */
export const Pending = () => (
  <Row>
    <StreakPill streak={0} pending />
  </Row>
);
