import React, { useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/tokens';
import { BackgroundCards } from './BackgroundCards';

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

  return (
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
            paddingTop: spacing.screen.paddingTop + insets.top,
            paddingHorizontal: spacing.screen.paddingHorizontal,
            paddingBottom: spacing.screen.paddingBottom,
          },
          contentStyle,
        ]}>
        <View style={styles.column}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, zIndex: 1 },
  column: { width: '100%', maxWidth: spacing.maxContentWidth, alignSelf: 'center' },
});
