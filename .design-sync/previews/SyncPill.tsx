import { SyncPill, View } from 'poker-coach';

/** Pills sit in a row in the header, sized to their content. */
const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row' }}>{children}</View>
);

/** No connection: answers queue up and land when it comes back. */
export const Offline = () => (
  <Row>
    <SyncPill offline unsaved={0} />
  </Row>
);

/** Progress the server refused — said plainly, not hidden behind a tick. */
export const NotSaved = () => (
  <Row>
    <SyncPill offline={false} unsaved={2} />
  </Row>
);
