import { TabBar } from 'poker-coach';

const noop = () => {};

/** The bottom bar: Home, Path, Chips, You. The active tab takes the mid-green fill. */
export const OnHome = () => <TabBar tab="home" onSelect={noop} />;

export const OnChips = () => <TabBar tab="chips" onSelect={noop} />;
