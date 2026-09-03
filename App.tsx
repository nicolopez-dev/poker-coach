import { Archivo_400Regular, Archivo_800ExtraBold, useFonts } from '@expo-google-fonts/archivo';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, authScreenShowing, useAuth } from './src/auth/AuthProvider';
import { Felt } from './src/components/Felt';
import { Header } from './src/components/Header';
import { TabBar } from './src/components/TabBar';
import { VerifyBanner } from './src/components/VerifyBanner';
import { ChipsScreen } from './src/screens/ChipsScreen';
import { DrillOverlay } from './src/screens/DrillOverlay';
import { ForgotScreen } from './src/screens/ForgotScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PathScreen } from './src/screens/PathScreen';
import { ProfileSetupScreen } from './src/screens/ProfileSetupScreen';
import { ResetScreen } from './src/screens/ResetScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { YouScreen } from './src/screens/YouScreen';
import { StoreProvider, useStore } from './src/state/store';
import { colors } from './src/theme/tokens';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <StoreProvider>
          <Gate />
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Nothing renders until both the fonts and the stored session are in. A cold start with
 * a valid session goes straight to the tabs — flashing the login screen for a frame
 * while SecureStore is read is the one thing this has to avoid.
 */
function Gate() {
  const [fontsLoaded] = useFonts({ Archivo_400Regular, Archivo_800ExtraBold });
  const { status } = useAuth();

  if (!fontsLoaded || status === 'loading') return <View style={styles.root} />;
  return <Root signedIn={status === 'signedIn'} />;
}

/**
 * Four tabs under a translucent header, with the login and drill overlays
 * stacked on top. Panes unmount on tab change, which resets the parallax.
 */
function Root({ signedIn }: { signedIn: boolean }) {
  const { tab, drillOpen, streak, hearts, go } = useStore();
  const { screen } = useAuth();

  const gate = authScreenShowing(screen, signedIn);

  return (
    <View style={styles.root}>
      <Felt />
      {tab === 'home' && <HomeScreen />}
      {tab === 'path' && <PathScreen />}
      {tab === 'chips' && <ChipsScreen />}
      {tab === 'you' && <YouScreen />}
      <TabBar tab={tab} onSelect={go} />
      <Header streak={streak} hearts={hearts} />
      {signedIn && <VerifyBanner />}
      {drillOpen && <DrillOverlay />}
      {gate && <AuthStack />}
    </View>
  );
}

/**
 * The auth stack, picked by `screen` exactly as the panes above are picked by `tab` —
 * no navigation library, same conditional render. Exhaustive on purpose: adding a
 * screen to the union without rendering it is a type error, not a blank overlay.
 */
function AuthStack() {
  const { screen } = useAuth();

  switch (screen) {
    case 'login':
      return <LoginScreen />;
    case 'signUp':
      return <SignUpScreen />;
    case 'forgot':
      return <ForgotScreen />;
    case 'reset':
      return <ResetScreen />;
    case 'profileSetup':
      return <ProfileSetupScreen />;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
