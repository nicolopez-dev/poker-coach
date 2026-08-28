import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Tab } from '../state/store';
import { colors, font, ls, radius } from '../theme/tokens';
import { ChipIcon, HomeIcon, TrendingUpIcon, UserIcon } from './icons';

const TABS: { key: Tab; label: string; Icon: React.ComponentType<{ color: string }> }[] = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'path', label: 'Path', Icon: TrendingUpIcon },
  { key: 'chips', label: 'Chips', Icon: ChipIcon },
  { key: 'you', label: 'You', Icon: UserIcon },
];

export function TabBar({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: 14 + insets.bottom }]}>
      {TABS.map(({ key, label, Icon }) => {
        const active = tab === key;
        const ink = active ? colors.text : colors.textMuted;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { backgroundColor: colors.greenMid }]}>
            <Icon color={ink} />
            <Text style={[styles.label, { color: ink }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    zIndex: 1,
    flexDirection: 'row',
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(10,20,15,.86)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(240,239,233,.12)',
  },
  tab: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.row,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
  },
});
