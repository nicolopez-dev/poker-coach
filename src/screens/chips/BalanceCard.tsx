import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Rise } from '../../components/anim';
import { Chip, ChipEdge } from '../../components/Chip';
import { NumberField, Suit } from '../../components/ui';
import {
  fmt,
  pointScale,
  POINTS_PER_UNIT,
  seatBalance,
  signedPoints,
  signedUnits,
  tally,
} from '../../lib/balance';
import type { DealResult, DealtRow } from '../../lib/chips';
import { NAME_MAX_LENGTH, shortName } from '../../lib/names';
import { useStore } from '../../state/store';
import { colors, font, ls, radius, shadows, type } from '../../theme/tokens';

/** Max chips drawn under the top chip in a stack column. */
const MAX_SLICES = 4;

/** Turns end-of-game chip counts back into units. */
export function BalanceCard({
  result,
  rows,
}: {
  result: DealResult;
  rows: DealtRow[];
}) {
  const { players, buyIn, ends, names, editingName, setEnd, setName, setEditingName } = useStore();

  const dealtStack = result.val;
  const scale = pointScale(buyIn, dealtStack);
  const summary = tally(ends, buyIn, dealtStack, players);

  return (
    <Rise duration={350} style={styles.card}>
      <View style={styles.head}>
        <Suit glyph="♣" size={18} color={colors.red} />
        <Text style={styles.kicker}>Balance</Text>
      </View>
      <Text style={[type.sectionHeading, styles.title]}>What a point is worth</Text>
      <Text style={styles.intro}>
        {players} players got {fmt(dealtStack)} points each against a {fmt(buyIn)}-point entry (
        {Math.round(buyIn / POINTS_PER_UNIT)} units). Count the chips at the end and every point
        converts back at the rate below.
      </Text>

      <View style={styles.stacks}>
        {rows.map((r) => (
          <View key={`${r.colorIndex}-${r.value}`} style={styles.stack}>
            <View style={styles.stackChips}>
              <Chip size={30} swatch={r.swatch} value={r.value} />
              {Array.from({ length: Math.max(0, Math.min(MAX_SLICES, r.qty - 1)) }, (_, i) => (
                <ChipEdge key={i} swatch={r.swatch} />
              ))}
            </View>
            <Text style={styles.stackQty}>×{r.qty}</Text>
            <Text style={styles.stackValue}>{r.value} pts</Text>
          </View>
        ))}
      </View>

      <View style={styles.ratePills}>
        <View style={[styles.ratePill, { backgroundColor: colors.greenDeep }]}>
          <Text style={styles.rateValue}>1 point = {scale.toFixed(3)} </Text>
          <Text style={styles.rateLabel}>of entry</Text>
        </View>
        <View style={[styles.ratePill, { backgroundColor: colors.surfaceInput }]}>
          <Text style={styles.rateValue}>1 unit = {POINTS_PER_UNIT} </Text>
          <Text style={[styles.rateLabel, { color: colors.textMuted }]}>points, always</Text>
        </View>
      </View>

      <View style={styles.tableHead}>
        <Text style={[styles.tableLabel, { width: 58 }]}>Seat</Text>
        <Text style={[styles.tableLabel, { width: 62, textAlign: 'center' }]}>End pts</Text>
        <Text style={[styles.tableLabel, { flex: 1, textAlign: 'right' }]}>Counts as</Text>
        <Text style={[styles.tableLabel, { width: 70, textAlign: 'right' }]}>Balance</Text>
      </View>

      <View style={{ gap: 7 }}>
        {ends.map((end, i) => {
          const seat = seatBalance(end, buyIn, dealtStack);
          const full = names[i] ?? '';
          const bg =
            seat.net > 0 ? colors.redTintDeep : seat.net < 0 ? colors.surfaceLocked : colors.surface;
          return (
            <View key={i} style={[styles.seatRow, { backgroundColor: bg }]}>
              <TextInput
                value={editingName === i ? full : shortName(full)}
                onChangeText={(v) => setName(i, v)}
                onFocus={() => setEditingName(i)}
                onBlur={() => setEditingName(null)}
                placeholder={`P${i + 1}`}
                placeholderTextColor={colors.textFaint}
                maxLength={NAME_MAX_LENGTH}
                numberOfLines={1}
                selectionColor={colors.gold}
                accessibilityLabel={full || `Seat ${i + 1}`}
                style={[styles.nameField, editingName === i && styles.nameFieldFocused]}
              />
              <NumberField
                value={String(end)}
                onChangeText={(v) => setEnd(i, v)}
                width={62}
                style={styles.endField}
                accessibilityLabel={`Seat ${i + 1} end points`}
              />
              <Text style={styles.countsAs}>{fmt(seat.countsAs)} pts</Text>
              <View style={styles.balanceCell}>
                <Text
                  style={[
                    styles.balanceValue,
                    {
                      color:
                        seat.net > 0
                          ? colors.redSoft
                          : seat.net < 0
                            ? colors.textSecondary
                            : colors.textFaint,
                    },
                  ]}>
                  {signedPoints(seat.net)}
                </Text>
                <Text style={styles.balanceUnits}>{signedUnits(seat.units)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.tally}>
        <Text
          style={[
            styles.tallyMessage,
            { color: summary.balanced ? colors.textMuted : colors.redSoft },
          ]}>
          {summary.message}
        </Text>
        <Text
          style={[
            styles.tallyFigure,
            { color: summary.balanced ? colors.textMuted : colors.redSoft },
          ]}>
          {summary.unitsInPlay.toFixed(2)} units in play
        </Text>
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 18,
    ...shadows.row,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  title: { marginBottom: 6 },
  intro: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.textMuted,
    marginBottom: 14,
  },
  stacks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: 16,
    columnGap: 14,
    paddingTop: 4,
    paddingHorizontal: 2,
    paddingBottom: 6,
    marginBottom: 12,
  },
  stack: { alignItems: 'center', gap: 7 },
  stackChips: { alignItems: 'center', gap: 2 },
  stackQty: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, color: colors.textSecondary },
  stackValue: { fontFamily: font.regular, fontSize: 9, lineHeight: 11, color: colors.textMuted },
  ratePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  ratePill: {
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rateValue: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, color: colors.text },
  rateLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: 'rgba(240,239,233,.7)',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  tableLabel: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.1),
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.balanceRow,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  nameField: {
    width: 58,
    minHeight: 38,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.text,
  },
  nameFieldFocused: {
    borderColor: colors.goldRule,
    backgroundColor: colors.surfaceInputAlt,
  },
  endField: { minHeight: 38, borderRadius: radius.input },
  countsAs: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 14,
    color: colors.textMuted,
  },
  balanceCell: { width: 70, alignItems: 'flex-end' },
  balanceValue: { fontFamily: font.bold, fontSize: 14, lineHeight: 16 },
  balanceUnits: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  tally: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(240,239,233,.12)',
  },
  tallyMessage: { flex: 1, fontFamily: font.regular, fontSize: 12, lineHeight: 12 * 1.4 },
  tallyFigure: { fontFamily: font.bold, fontSize: 12, lineHeight: 12 * 1.4 },
});
