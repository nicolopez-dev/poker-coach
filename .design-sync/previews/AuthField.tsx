import { AuthField, Text, View, colors, font } from 'poker-coach';

const noop = () => {};

/** The login pair: placeholders only, 9 apart. */
export const LoginPair = () => (
  <View style={{ gap: 9 }}>
    <AuthField placeholder="you@table.com" inputMode="email" autoCapitalize="none" />
    <AuthField placeholder="Password" secureTextEntry />
  </View>
);

/** Filled in. */
export const Filled = () => (
  <View style={{ gap: 9 }}>
    <AuthField value="nico@table.com" onChangeText={noop} />
    <AuthField value="hunter22" secureTextEntry onChangeText={noop} />
  </View>
);

/** With the error line the auth screens put under the pair. */
export const WithError = () => (
  <View style={{ gap: 9 }}>
    <AuthField value="nico@table" onChangeText={noop} />
    <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: colors.redSoft }}>
      That email doesn’t look right.
    </Text>
  </View>
);
