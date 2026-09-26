import { CloseIcon, Pressable, View, colors, radius } from 'poker-coach';

/** The drill overlay's close button: the X at 16, stroke 2.4, in a round surface. */
export const CloseButton = () => (
  <View style={{ flexDirection: 'row' }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceInput,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <CloseIcon color={colors.text} />
    </Pressable>
  </View>
);

/** Sizes; `color` is required. */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <CloseIcon size={16} color={colors.text} />
    <CloseIcon size={24} color={colors.textMuted} />
    <CloseIcon size={32} color={colors.text} />
  </View>
);
