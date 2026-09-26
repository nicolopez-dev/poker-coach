import { CardBack, View, radius } from 'poker-coach';

/** CardBack fills its parent: give the card its size, and its shadow, from outside. */
const Card = ({ w, h, r }: { w: number; h: number; r: number }) => (
  <View style={{ width: w, height: h, borderRadius: r, boxShadow: '0 2px 8px rgba(0,0,0,.5)' }}>
    <CardBack radius={r} />
  </View>
);

/** Face-down board cards, the size the Hand of the day deals them. */
export const Board = () => (
  <View style={{ flexDirection: 'row', gap: 7 }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Card key={i} w={46} h={64} r={radius.tile} />
    ))}
  </View>
);

/** One large card: the 45° stripes tile at a fixed pitch, they do not stretch. */
export const Large = () => <Card w={120} h={168} r={12} />;
