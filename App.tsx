import { Archivo_400Regular, Archivo_800ExtraBold, useFonts } from '@expo-google-fonts/archivo';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Felt } from './src/components/Felt';
import { Header } from './src/components/Header';
import { TabBar } from './src/components/TabBar';
import { ChipsScreen } from './src/screens/ChipsScreen';
import { DrillOverlay } from './src/screens/DrillOverlay';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PathScreen } from './src/screens/PathScreen';
import { YouScreen } from './src/screens/YouScreen';
import { StoreProvider, useStore } from './src/state/store';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts({ Archivo_400Regular, Archivo_800ExtraBold });

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <StoreProvider>{fontsLoaded ? <Root /> : <View style={styles.root} />}</StoreProvider>
    </SafeAreaProvider>
  );
}

/**
 * Four tabs under a translucent header, with the login and drill overlays
 * stacked on top. Panes unmount on tab change, which resets the parallax.
 */
function Root() {
  const { tab, authed, drillOpen, streak, hearts, go } = useStore();

  return (
    <View style={styles.root}>
      <Felt />
      {tab === 'home' && <HomeScreen />}
      {tab === 'path' && <PathScreen />}
      {tab === 'chips' && <ChipsScreen />}
      {tab === 'you' && <YouScreen />}
      <TabBar tab={tab} onSelect={go} />
      <Header streak={streak} hearts={hearts} />
      {drillOpen && <DrillOverlay />}
      {!authed && <LoginScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
});
