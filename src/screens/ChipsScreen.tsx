import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChipDrop } from '../components/anim';
import { SwatchPicker } from '../components/SwatchPicker';
import { TabScreen } from '../components/TabScreen';
import { NumberField, RedButton, pressable } from '../components/ui';
import {
  MAX_COLORS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_COLORS,
  MIN_PLAYERS,
} from '../data/chipCase';
import { fmt, POINTS_PER_UNIT } from '../lib/balance';
import { availablePoints, dealtRows, totalChips, type ChipColor } from '../lib/chips';
import { useStore } from '../state/store';
import { colors, font, ls, radius, shadows, type } from '../theme/tokens';
import { BalanceCard } from './chips/BalanceCard';
import { ResultCard } from './chips/ResultCard';

/**
 * The chip counter: what's in the case, how many seats, what the entry is —
 * then an equal stack per player with the denominations picked for you.
 */
export function ChipsScreen() {
  const store = useStore();
  const { players, buyIn, colors: chipCase, autoValues, result, stepPlayers, dealStacks } = store;

  const rows = dealtRows(result, chipCase);
  const inCase = totalChips(chipCase);

  // Reset on every fresh solve, and on a loaded game — which clears `result` too. The
  // panel is about one dealt table; it should not carry over to the next one.
  const [settleOpen, setSettleOpen] = useState(false);
  useEffect(() => {
    setSettleOpen(false);
  }, [result]);

  return (
    <TabScreen>
      <Text style={type.screenTitle}>What's in the case?</Text>
      <Text style={styles.sub}>
        Count your real chips. We'll deal fair stacks and pick the denominations.
      </Text>

      <View style={styles.settings}>
        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Players</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => stepPlayers(-1)}
              disabled={players <= MIN_PLAYERS}
              accessibilityRole="button"
              accessibilityLabel="Fewer players"
              style={[styles.stepButton, styles.stepMinus, players <= MIN_PLAYERS && styles.dim]}>
              <Text style={styles.stepGlyph}>−</Text>
            </Pressable>
            <Text style={styles.playerCount}>{players}</Text>
            <Pressable
              onPress={() => stepPlayers(1)}
              disabled={players >= MAX_PLAYERS}
              accessibilityRole="button"
              accessibilityLabel="More players"
              style={[styles.stepButton, styles.stepPlus, players >= MAX_PLAYERS && styles.dim]}>
              <Text style={styles.stepGlyph}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.settingCard}>
          <Text style={styles.settingLabel}>Entry bet</Text>
          <View style={styles.betRow}>
            <EntryBetField />
            <Text style={styles.unitsLabel}>units</Text>
          </View>
        </View>
      </View>

      {/* The three facts used to live inside the Entry bet card, which stretched the
          Players card to match it. Out here they are one quiet line and the two cards
          come out the same height. */}
      <View style={styles.facts}>
        <Text style={styles.fact}>
          1 unit = <Text style={styles.factValue}>{POINTS_PER_UNIT} pts</Text>
        </Text>
        <Text style={styles.fact}>
          Stack <Text style={styles.factValue}>{fmt(buyIn)} pts</Text>
        </Text>
        <Text style={styles.fact}>
          Case <Text style={styles.factValue}>{fmt(availablePoints(chipCase, players))} pts each</Text>
        </Text>
      </View>

      <View style={styles.caseHeader}>
        <Text style={styles.caseLabel}>The chip case</Text>
        <View style={styles.segmented}>
          <Segment label="Auto values" active={autoValues} onPress={() => store.setAutoValues(true)} />
          <Segment label="My values" active={!autoValues} onPress={() => store.setAutoValues(false)} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {chipCase.map((color, i) => (
          <ChipRow key={i} index={i} color={color} />
        ))}
      </View>

      <View style={styles.addRow}>
        <Pressable
          onPress={store.addColor}
          disabled={chipCase.length >= MAX_COLORS}
          accessibilityRole="button"
          style={[styles.addButton, chipCase.length >= MAX_COLORS && styles.dim]}>
          <Text style={styles.addLabel}>+ Add chip colour</Text>
        </Pressable>
        <Text style={styles.caseTotal}>
          {inCase} chips{'\n'}in the case
        </Text>
      </View>

      <RedButton
        label="Deal the stacks"
        glyph="♦"
        onPress={dealStacks}
        style={styles.dealButton}
      />

      {result && (
        <>
          <ResultCard
            result={result}
            rows={rows}
            colors={chipCase}
            buyIn={buyIn}
            players={players}
            chipsInCase={inCase}
            autoValues={autoValues}
          />
          {/* The Balance panel used to appear the moment stacks were solved, which put
              end-of-night arithmetic in front of someone who had not dealt yet. It waits
              behind this now, and folds itself away whenever a new deal is solved. */}
          {settleOpen ? (
            <BalanceCard result={result} rows={rows} />
          ) : (
            <Pressable
              onPress={() => setSettleOpen(true)}
              accessibilityRole="button"
              style={pressable(styles.settleGate, 0.99)}>
              <Text style={styles.settleGateLabel}>Settle the table →</Text>
            </Pressable>
          )}
        </>
      )}

      <View style={{ height: 30 }} />
    </TabScreen>
  );
}

/** Entry is typed in units; the store keeps it in points. */
function EntryBetField() {
  const { buyIn, setBet } = useStore();
  const units = Math.round(buyIn / POINTS_PER_UNIT);
  const [text, setText] = useState(String(units));
  const focused = useRef(false);

  // keep in step with the store when a saved game is loaded in
  useEffect(() => {
    if (!focused.current) setText(String(units));
  }, [units]);

  return (
    <NumberField
      value={text}
      onChangeText={(v) => {
        const digitsOnly = v.replace(/[^0-9]/g, '');
        setText(digitsOnly);
        // An empty field is a moment mid-edit, not an entry of nothing. Clearing it to
        // type a new number used to snap the stack to one unit under the cursor and
        // rewrite the line below; the stack now stays where it was until there is a
        // number to read, or until the field is left empty on blur.
        if (digitsOnly !== '') setBet(digitsOnly);
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        if (text === '') {
          setBet('1');
          setText('1');
        } else {
          // whatever was typed, shown back as the store clamped it
          setText(String(units));
        }
      }}
      width={78}
      accessibilityLabel="Entry bet in units"
      style={styles.betField}
    />
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && { backgroundColor: colors.greenMid }]}>
      <Text style={[styles.segmentLabel, { color: active ? colors.text : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChipRow({ index, color }: { index: number; color: ChipColor }) {
  const store = useStore();
  const [picking, setPicking] = useState(false);
  const locked = store.autoValues;
  const canRemove = store.colors.length > MIN_COLORS;

  return (
    <ChipDrop duration={300} style={styles.chipRow}>
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={`${color.name} chip colour`}
        style={[styles.well, { backgroundColor: color.swatch }]}
      />
      <SwatchPicker
        visible={picking}
        selected={color.swatch}
        onPick={(swatch) => store.setColorSwatch(index, swatch)}
        onClose={() => setPicking(false)}
      />

      <TextInput
        value={color.name}
        onChangeText={(v) => store.setColorName(index, v)}
        maxLength={MAX_NAME_LENGTH}
        selectionColor={colors.red}
        accessibilityLabel="Chip name"
        style={styles.nameField}
      />

      <View style={styles.field}>
        <NumberField
          value={String(color.count)}
          onChangeText={(v) => store.setColorCount(index, v)}
          width={52}
          accessibilityLabel={`${color.name} quantity`}
        />
        <Text style={styles.fieldCaption}>qty</Text>
      </View>

      <View style={styles.field}>
        <NumberField
          value={String(color.value)}
          onChangeText={(v) => store.setColorValue(index, v)}
          editable={!locked}
          width={56}
          accessibilityLabel={`${color.name} value`}
          style={
            locked
              ? { backgroundColor: colors.valueLocked, color: colors.textFaint }
              : undefined
          }
        />
        <Text style={styles.fieldCaption}>value</Text>
      </View>

      <Pressable
        onPress={() => store.removeColor(index)}
        disabled={!canRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${color.name}`}
        style={[styles.remove, !canRemove && styles.dim]}>
        <Text style={styles.removeGlyph}>×</Text>
      </Pressable>
    </ChipDrop>
  );
}

const styles = StyleSheet.create({
  sub: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.4,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  settings: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  settingCard: {
    flex: 1,
    borderRadius: radius.smallCard,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...shadows.row,
  },
  settingLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.1),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 9,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepMinus: { backgroundColor: colors.surfaceInput },
  stepPlus: { backgroundColor: colors.greenDeep },
  stepGlyph: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, color: colors.text },
  playerCount: { fontFamily: font.bold, fontSize: 26, lineHeight: 28, color: colors.text },
  dim: { opacity: 0.45 },
  betRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  betField: {
    minHeight: 44,
    borderRadius: radius.inputLarge,
    fontSize: 22,
    paddingHorizontal: 10,
    textAlign: 'left',
  },
  unitsLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  /** what stands where the Balance panel will open */
  settleGate: {
    marginTop: 20,
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.goldRule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleGateLabel: {
    fontFamily: font.bold,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: ls(12, 0.08),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  /** the unit / stack / case line, sitting under both setting cards */
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
    columnGap: 16,
    marginTop: -4,
    marginHorizontal: 2,
    marginBottom: 16,
  },
  fact: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 10 * 1.5,
    color: colors.textFaint,
  },
  factValue: { fontFamily: font.bold, color: colors.textSecondary },
  caseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  caseLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  segmented: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.pill,
    padding: 3,
  },
  segment: { borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13 },
  segmentLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
  },
  chipRow: {
    borderRadius: radius.smallCard,
    backgroundColor: colors.surface,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...shadows.row,
  },
  well: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(240,239,233,.35)',
  },
  nameField: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    borderRadius: radius.input,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.text,
  },
  field: { alignItems: 'center', gap: 2 },
  fieldCaption: {
    fontFamily: font.regular,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: ls(8, 0.08),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  remove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  removeGlyph: { fontFamily: font.bold, fontSize: 14, lineHeight: 16, color: colors.textMuted },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  addButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(240,239,233,.3)',
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  addLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.06),
    textTransform: 'uppercase',
    color: colors.text,
  },
  caseTotal: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 11 * 1.2,
    color: colors.textMuted,
    textAlign: 'right',
  },
  dealButton: { marginTop: 16 },
});
