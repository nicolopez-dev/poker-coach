import { OutlineButton, View } from 'poker-coach';

const noop = () => {};

/** Label left, suit right — the streak-lapse card's "Start again". */
export const WithGlyph = () => <OutlineButton label="Start again" glyph="♠" height={46} onPress={noop} />;

/** No glyph: the label centres. */
export const Plain = () => <OutlineButton label="Dismiss" height={46} onPress={noop} />;

/** `active`: the hairline and label turn gold. */
export const Active = () => <OutlineButton label="Your games" glyph="♣" active onPress={noop} />;

/** Unavailable until the confirmation is typed out. */
export const Disabled = () => <OutlineButton label="Delete account" disabled onPress={noop} />;

/** Side by side, as the lapse card lays them out. */
export const Pair = () => (
  <View style={{ flexDirection: 'row', gap: 10 }}>
    <OutlineButton label="Start again" glyph="♠" height={46} onPress={noop} style={{ flex: 1 }} />
    <OutlineButton label="Dismiss" height={46} onPress={noop} style={{ flex: 1 }} />
  </View>
);
