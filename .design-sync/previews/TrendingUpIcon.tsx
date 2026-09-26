import { TrendingUpIcon, View, colors } from 'poker-coach';

/** Path — the progress tab. Lucide line icon, stroke 2, round caps; `color` is required — text when the tab is active, textMuted when it is not. */
export const TabStates = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <TrendingUpIcon color={colors.text} />
    <TrendingUpIcon color={colors.textMuted} />
  </View>
);

/** Sizes. */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <TrendingUpIcon size={16} color={colors.text} />
    <TrendingUpIcon size={24} color={colors.text} />
    <TrendingUpIcon size={32} color={colors.text} />
  </View>
);
