import { ChipDisc, Text, View, colors, font } from 'poker-coach';

const RANK_NAMES = ['White chip', 'Red chip', 'Green chip', 'Blue chip', 'Black chip'];

/**
 * The You tab's rank ladder: the flat chip, at rest, one per rank. Ranks not reached yet
 * are `dimmed`.
 */
export const RankLadder = () => (
  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
    {RANK_NAMES.map((name, i) => (
      <View key={name} style={{ alignItems: 'center', gap: 6, width: 58 }}>
        <ChipDisc rankIndex={i} size={34} dimmed={i > 2} />
        <Text
          style={{
            fontFamily: font.bold,
            fontSize: 10,
            lineHeight: 12,
            color: i > 2 ? colors.textFaint : colors.text,
            textAlign: 'center',
          }}>
          {name}
        </Text>
      </View>
    ))}
  </View>
);

/** An explicit chip with a marked face — the paid chips in the streak card's row. */
export const StreakChips = () => (
  <View style={{ flexDirection: 'row', gap: 7 }}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={{ borderRadius: 15, boxShadow: '0 2px 4px rgba(0,0,0,.55)' }}>
        <ChipDisc
          size={30}
          colours={{ swatch: colors.goldRule, dash: '#ffffff' }}
          face={colors.gold}
          mark="♠"
          markInk={colors.cardInk}
        />
      </View>
    ))}
  </View>
);
