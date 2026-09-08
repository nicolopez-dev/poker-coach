import React, { createContext, useContext, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/tokens';
import { BackgroundCards } from './BackgroundCards';
import { useVerifyBanner } from './VerifyBanner';

/**
 * The pane's scroll offset, for anything that has to know where it is on screen.
 *
 * The value is fed with the native driver so the parallax stays off the JS thread —
 * read it with `addListener`, never by swapping the driver off.
 */
const ScrollOffset = createContext<Animated.Value | null>(null);

export const useScrollOffset = () => useContext(ScrollOffset);

/**
 * One tab's pane: the parallax aces, then a scroller whose offset drives them.
 * Panes unmount on tab change, which resets the parallax to 0.
 * On wide screens the column caps and centres; phones stay full width.
 */
export function TabScreen({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: object;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  // the verify strip sits under the header, so the pane has to start under it too
  const banner = useVerifyBanner();

  return (
    <ScrollOffset.Provider value={scrollY}>
    <View style={styles.pane}>
      <BackgroundCards scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: Platform.OS !== 'web',
        })}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          {
            paddingTop: spacing.screen.paddingTop + insets.top + banner.height,
            paddingHorizontal: spacing.screen.paddingHorizontal,
            paddingBottom: spacing.screen.paddingBottom,
          },
          contentStyle,
        ]}>
        <View style={styles.column}>{children}</View>
      </Animated.ScrollView>
    </View>
    </ScrollOffset.Provider>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, zIndex: 1 },
  column: { width: '100%', maxWidth: spacing.maxContentWidth, alignSelf: 'center' },
});
