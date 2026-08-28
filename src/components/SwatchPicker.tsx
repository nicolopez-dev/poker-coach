import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SWATCHES } from '../data/chipCase';
import { colors, font, ls, radius } from '../theme/tokens';

/**
 * Chip colour picker. The web prototype opens the OS colour input; on a phone
 * a sheet of the case's own swatches is both faster and thumb-friendly.
 */
export function SwatchPicker({
  visible,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onPick: (swatch: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Chip colour</Text>
          <View style={styles.grid}>
            {SWATCHES.map((swatch) => (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={swatch}
                onPress={() => {
                  onPick(swatch);
                  onClose();
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch },
                  swatch.toLowerCase() === selected.toLowerCase() && styles.swatchSelected,
                ]}
              />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,10,7,.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
  },
  title: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(240,239,233,.2)',
  },
  swatchSelected: { borderColor: colors.gold, borderWidth: 3 },
});
