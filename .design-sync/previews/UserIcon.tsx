import { UserIcon, View, colors } from 'poker-coach';

/** You — the profile tab. Lucide line icon, stroke 2, round caps; `color` is required — text when the tab is active, textMuted when it is not. */
export const TabStates = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <UserIcon color={colors.text} />
    <UserIcon color={colors.textMuted} />
  </View>
);

/** Sizes. */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <UserIcon size={16} color={colors.text} />
    <UserIcon size={24} color={colors.text} />
    <UserIcon size={32} color={colors.text} />
  </View>
);
