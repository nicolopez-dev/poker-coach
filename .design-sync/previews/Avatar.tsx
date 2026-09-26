import { Avatar, Text, View, colors, font } from 'poker-coach';

const SUITS = ['spade', 'heart', 'diamond', 'club'];
const GROUNDS = ['felt', 'table', 'night', 'ink'];

/**
 * The built-in set: four suits on four grounds, ids `<suit>-<ground>`. No red — a ♥
 * avatar takes the same ink as a ♠; near-black grounds take gold.
 */
export const Set = () => (
  <View style={{ gap: 10 }}>
    {GROUNDS.map((g) => (
      <View key={g} style={{ flexDirection: 'row', gap: 10 }}>
        {SUITS.map((s) => (
          <Avatar key={s} avatarId={`${s}-${g}`} size={52} />
        ))}
      </View>
    ))}
  </View>
);

/** The You tab's identity row. */
export const Profile = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
    <Avatar avatarId="club-night" name="Sam Ortega" size={60} />
    <View>
      <Text style={{ fontFamily: font.bold, fontSize: 18, lineHeight: 21, color: colors.text }}>
        Sam Ortega
      </Text>
      <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted }}>
        Green chip · 12 day streak
      </Text>
    </View>
  </View>
);

/** An unknown or empty id falls back to initials — never an empty circle. */
export const InitialsFallback = () => (
  <View style={{ flexDirection: 'row', gap: 12 }}>
    <Avatar avatarId={null} name="Sam Ortega" size={60} />
    <Avatar avatarId="retired-id" name="Ana" size={60} />
    <Avatar avatarId={null} name={null} size={60} />
  </View>
);
