import { StatPill, View } from 'poker-coach';

/** Big number, small uppercase label — a row of them under a heading. */
export const Row = () => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    <StatPill value="38" label="lessons" />
    <StatPill value="82%" label="accuracy" />
    <StatPill value="1,240" label="xp" />
  </View>
);

export const Single = () => (
  <View style={{ flexDirection: 'row' }}>
    <StatPill value="12" label="day streak" />
  </View>
);
