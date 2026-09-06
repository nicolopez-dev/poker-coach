import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { absoluteFill, colors, headerFill } from '../theme/tokens';
import { Brand, HeartsPill, StreakPill } from './ui';

/**
 * Persistent header. Content scrolls behind it, so it stays translucent and
 * blurred; the screens reserve 66px of top padding to clear it.
 *
 * `pending` is the gap before the server answers: both pills show a placeholder rather
 * than the zeros the store starts on.
 */
export function Header({
  streak,
  hearts,
  pending = false,
  nextHeartAt = null,
  clockOffset = 0,
}: {
  streak: number;
  hearts: number;
  pending?: boolean;
  nextHeartAt?: string | null;
  clockOffset?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={30}
      tint="dark"
      experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      style={[styles.header, { paddingTop: 16 + insets.top }]}>
      <View style={styles.fill} />
      <Brand />
      <View style={styles.right}>
        <StreakPill streak={streak} pending={pending} />
        <HeartsPill
          hearts={hearts}
          pending={pending}
          nextHeartAt={nextHeartAt}
          clockOffset={clockOffset}
        />
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineFaint,
    overflow: 'hidden',
  },
  fill: { ...absoluteFill, backgroundColor: headerFill },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
