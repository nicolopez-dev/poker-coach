import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { findAvatar } from '../data/avatars';
import { shortName } from '../lib/names';
import { colors, font } from '../theme/tokens';
import { Suit } from './ui';

/**
 * A player's avatar: the suit tile they picked, or their initials.
 *
 * The fallback is not a nicety. `avatar_id` is a stable string in a database row, and
 * anything can put an unknown one there — a build older than the set, a row written
 * before an id was renamed, a null on a profile nobody has filled in yet. Initials are
 * always renderable, so this never draws an empty circle.
 */
export function Avatar({
  avatarId,
  name,
  size = 60,
  style,
}: {
  avatarId: string | null | undefined;
  /** used only for the initials fallback */
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const avatar = findAvatar(avatarId);
  const initials = shortName(name ?? '');

  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: avatar?.fill ?? colors.greenDeep,
  };

  return (
    <View style={[styles.circle, circle, style]}>
      {avatar ? (
        // the platform font draws the pip; Archivo has no card glyphs
        <Suit glyph={avatar.glyph} size={size * 0.4} color={avatar.ink} />
      ) : (
        <Text
          numberOfLines={1}
          style={[styles.initials, { fontSize: size * 0.36, lineHeight: size * 0.44 }]}>
          {initials || '♠'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: font.bold, color: colors.text, paddingHorizontal: 4 },
});
