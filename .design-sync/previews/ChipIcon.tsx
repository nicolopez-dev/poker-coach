import { ChipIcon, View, colors } from 'poker-coach';

/** Chips — the chip tool tab. Lucide line icon, stroke 2, round caps; `color` is required — text when the tab is active, textMuted when it is not. */
export const TabStates = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <ChipIcon color={colors.text} />
    <ChipIcon color={colors.textMuted} />
  </View>
);

/** Sizes. */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <ChipIcon size={16} color={colors.text} />
    <ChipIcon size={24} color={colors.text} />
    <ChipIcon size={32} color={colors.text} />
  </View>
);
