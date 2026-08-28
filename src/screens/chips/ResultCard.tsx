import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChipDrop, Pop } from '../../components/anim';
import { Chip } from '../../components/Chip';
import { RewardCard } from '../../components/Gold';
import { Divider, RewardPill } from '../../components/ui';
import { fmt } from '../../lib/balance';
import {
  COARSE_CHIP_SHARE,
  smallestDenom,
  undealtColors,
  type ChipColor,
  type DealResult,
  type DealtRow,
} from '../../lib/chips';
import { colors, font, ls, radius, shadows, type } from '../../theme/tokens';

export function ResultCard({
  result,
  rows,
  colors,
  buyIn,
  players,
  chipsInCase,
  autoValues,
}: {
  result: DealResult;
  rows: DealtRow[];
  colors: ChipColor[];
  buyIn: number;
  players: number;
  chipsInCase: number;
  autoValues: boolean;
}) {
  const dealt = result.total * players;
  const satOut = undealtColors(colors, rows);
  const lowest = smallestDenom(rows);
  const fineEnough = lowest <= buyIn * COARSE_CHIP_SHARE;

  const note = result.ok
    ? fineEnough
      ? `Smallest chip is worth ${lowest} — small enough for blinds, few enough to stack by eye.`
      : `Careful: your smallest chip is worth ${lowest}, a big bite out of a ${buyIn}-point stack. Add a smaller chip for room to bet.`
    : autoValues
      ? 'Add more low chips, drop the entry stack, or seat fewer players.'
      : `Your values can't make ${buyIn} exactly. Try Auto values, or add a smaller chip.`;

  return (
    <Pop style={styles.wrap}>
      <RewardCard radius={radius.hero} innerStyle={styles.card} reverse>
        <Text style={styles.kicker}>
          {result.ok ? 'Every player gets' : 'Closest we can get'}
        </Text>
        <Text style={[type.resultHeadline, styles.headline]}>
          {result.ok
            ? `${result.total} chips, worth ${buyIn} points`
            : `Only ${result.val} points fits`}
        </Text>

        <View style={{ gap: 9 }}>
          {rows.map((r) => (
            <ChipDrop key={`${r.colorIndex}-${r.value}`} duration={400} style={styles.row}>
              <Chip size={32} swatch={r.swatch} value={r.value} />
              <Text style={styles.rowName}>{r.name}</Text>
              <Text style={styles.rowQty}>×{r.qty}</Text>
              <Text style={styles.rowTotal}>{r.total}</Text>
            </ChipDrop>
          ))}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.pills}>
          <RewardPill value={result.val} label="per player" />
          <RewardPill value={dealt} label="dealt" />
          <RewardPill value={chipsInCase - dealt} label="in bank" />
        </View>

        <Text style={styles.note}>{note}</Text>
        {satOut.length > 0 && (
          <Text style={styles.note}>
            {list(satOut)} sat out — this stack has no room for{' '}
            {satOut.length > 1 ? 'them' : 'it'}.
          </Text>
        )}
        <Text style={styles.blinds}>
          Blinds:{' '}
          {fineEnough
            ? `${fmt(lowest)} / ${fmt(lowest * 2)}, up every 20 minutes`
            : 'too coarse to suggest — add a smaller chip'}
        </Text>
      </RewardCard>
    </Pop>
  );
}

/** "White", "White and Purple", "White, Purple and Teal". */
function list(names: string[]): string {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  card: { padding: 20, ...shadows.big },
  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: 'rgba(240,239,233,.6)',
    marginBottom: 8,
  },
  headline: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowName: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 15,
    color: 'rgba(240,239,233,.85)',
  },
  rowQty: { fontFamily: font.bold, fontSize: 15, lineHeight: 17, color: colors.textOnReward },
  rowTotal: {
    width: 56,
    textAlign: 'right',
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(240,239,233,.6)',
  },
  divider: { backgroundColor: 'rgba(240,239,233,.25)', marginTop: 16, marginBottom: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: 'rgba(240,239,233,.75)',
    marginTop: 14,
  },
  blinds: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 11 * 1.4,
    color: 'rgba(240,239,233,.55)',
    marginTop: 6,
  },
});
