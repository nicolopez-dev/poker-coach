import {
  Chip,
  Divider,
  RewardCard,
  RewardPill,
  StyleSheet,
  Text,
  View,
  colors,
  font,
  ls,
  radius,
  shadows,
  type,
} from 'poker-coach';

const rows = [
  { name: 'White', swatch: '#f4f1e6', value: 5, qty: 8 },
  { name: 'Red', swatch: '#ff7a63', value: 10, qty: 6 },
  { name: 'Green', swatch: '#4a6b52', value: 25, qty: 4 },
  { name: 'Blue', swatch: '#3a4f6b', value: 50, qty: 3 },
];

/** The Chips tab's result card: every seat's stack, what is dealt, what stays in the case. */
export const ChipResult = () => (
  <RewardCard radius={radius.hero} innerStyle={styles.card} reverse>
    <Text style={styles.kicker}>Every player gets</Text>
    <Text style={[type.resultHeadline, styles.headline]}>21 chips, worth 500 points</Text>
    <View style={{ gap: 9 }}>
      {rows.map((r) => (
        <View key={r.name} style={styles.row}>
          <Chip size={32} swatch={r.swatch} value={r.value} />
          <Text style={styles.rowName}>{r.name}</Text>
          <Text style={styles.rowQty}>×{r.qty}</Text>
          <Text style={styles.rowTotal}>{r.value * r.qty}</Text>
        </View>
      ))}
    </View>
    <Divider style={styles.divider} />
    <View style={styles.pills}>
      <RewardPill value={500} label="per player" />
      <RewardPill value={126} label="dealt" />
      <RewardPill value={74} label="in bank" />
    </View>
    <Text style={styles.note}>Six seats, five units each — the Black chips stay in the case.</Text>
    <Text style={styles.blinds}>Blinds: 5 / 10, up every 20 minutes</Text>
  </RewardCard>
);

/** The hero surface on its own: kicker, headline, body — the Home "today" card shape. */
export const Hero = () => (
  <RewardCard radius={radius.hero} innerStyle={styles.card}>
    <Text style={styles.kicker}>Chapter 3 · Lesson 4</Text>
    <Text style={[type.heroTitle, styles.headline]}>Pot odds on the river</Text>
    <Text style={styles.note}>
      Ten spots where the price is right there on the table. Call, fold, or raise — then see
      what the maths says.
    </Text>
  </RewardCard>
);

const styles = StyleSheet.create({
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
