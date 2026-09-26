import { GoogleIcon, Pressable, Text, View, colors, font, radius } from 'poker-coach';

/** The four-colour mark in the sign-in button, on the light pill the auth screens use. */
export const SignInButton = () => (
  <Pressable
    accessibilityRole="button"
    style={{
      minHeight: 52,
      borderRadius: radius.pill,
      backgroundColor: colors.cardFace,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 11,
      paddingHorizontal: 18,
    }}>
    <GoogleIcon />
    <Text style={{ fontFamily: font.bold, fontSize: 14, lineHeight: 16, color: colors.cardInk }}>
      Continue with Google
    </Text>
  </Pressable>
);

/** Sizes. The mark keeps its own colours; there is no `color` prop. */
export const Sizes = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <GoogleIcon size={17} />
    <GoogleIcon size={24} />
    <GoogleIcon size={32} />
  </View>
);
