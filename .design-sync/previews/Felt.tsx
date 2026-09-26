import { Felt, Suit, Text, View, colors, type } from 'poker-coach';

/**
 * Felt fills its parent absolutely — radial light from above the top edge, a woven
 * 3px cloth over it. Give the parent a size and put the content after it.
 */
export const DrillBackdrop = () => (
  <View
    style={{
      height: 300,
      borderRadius: 28,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
    <Felt />
    <Suit glyph="♠" size={64} color={colors.green} style={{ marginBottom: 14 }} />
    <Text style={[type.kicker, { marginBottom: 8 }]}>Not dealt yet</Text>
    <Text style={[type.sectionHeading, { textAlign: 'center' }]}>This chapter opens tomorrow</Text>
  </View>
);

/** The bare cloth. */
export const Cloth = () => (
  <View style={{ height: 180, borderRadius: 22, overflow: 'hidden' }}>
    <Felt />
  </View>
);
