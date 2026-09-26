import { Header, View } from 'poker-coach';

const nextHeart = new Date(Date.now() + (18 * 60 + 40) * 1000 + 500).toISOString();
const midnight = new Date(Date.now() + (3 * 60 + 20) * 60_000 + 30_000).toISOString();

/**
 * The persistent header is absolutely positioned at the top of the screen (content
 * scrolls under its blur; screens pad 66 to clear it), so it gets a sized box here.
 */
const Screen = ({ children }: { children: React.ReactNode }) => (
  <View style={{ height: 64, overflow: 'hidden' }}>{children}</View>
);

/** A good day: live streak, full hearts. */
export const Default = () => (
  <Screen>
    <Header streak={12} hearts={5} />
  </Screen>
);

/** Hearts refilling and the streak one day from lapsing. */
export const AtRisk = () => (
  <Screen>
    <Header
      streak={12}
      hearts={2}
      nextHeartAt={nextHeart}
      streakAtRisk
      streakExpiresAt={midnight}
    />
  </Screen>
);

/** No connection: the sync pill joins the row. */
export const Offline = () => (
  <Screen>
    <Header streak={4} hearts={5} offline />
  </Screen>
);

/** Before the server answers: dashes, never zeros. */
export const Pending = () => (
  <Screen>
    <Header streak={0} hearts={0} pending />
  </Screen>
);
