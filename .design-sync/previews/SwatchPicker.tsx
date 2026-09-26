import { SwatchPicker, View, colors } from 'poker-coach';

const noop = () => {};

/**
 * Open, with Green selected: a sheet of the case's own swatches over a dimmed backdrop.
 * The Modal covers the whole window, so the app's ground is laid under it first — the
 * sheet always opens over the Chips screen, never over white.
 */
export const Open = () => (
  <>
    <View style={{ height: 388, backgroundColor: colors.ground }} />
    <SwatchPicker visible selected="#4a6b52" onPick={noop} onClose={noop} />
  </>
);
