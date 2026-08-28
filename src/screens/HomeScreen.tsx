import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Rise } from '../components/anim';
import { RewardCard } from '../components/Gold';
import { TabScreen } from '../components/TabScreen';
import { ProgressBar, RewardButton, StatPill, Suit, pressable } from '../components/ui';
import { currentChapter } from '../content/progress';
import { COACH_NOTE, DAILY_GOAL, HOME_STATS, WEEK } from '../data/profile';
import { fmt } from '../lib/balance';
import { useProgress, useStore } from '../state/store';
import { colors, font, ls, radius, shadows, type } from '../theme/tokens';

export function HomeScreen() {
  const { xp, players, buyIn, startNextLesson, go } = useStore();
  const progress = useProgress();
  const chapter = currentChapter(progress);

  return (
    <TabScreen>
      <Rise duration={450}>
        <RewardCard radius={radius.hero} innerStyle={styles.hero}>
          <Suit glyph="♠" size={150} color="rgba(240,239,233,.08)" style={styles.heroSuit} />
          <Text style={styles.heroKicker}>Today's hand</Text>
          <Text style={[type.heroTitle, styles.heroTitle]}>{DAILY_GOAL.title}</Text>
          <ProgressBar
            pct={DAILY_GOAL.pct}
            height={12}
            track="rgba(240,239,233,.18)"
            style={styles.heroBar}
          />
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>{DAILY_GOAL.label}</Text>
            <Text style={styles.heroFooterText}>{fmt(xp)} XP</Text>
          </View>
        </RewardCard>
      </Rise>

      <RewardButton
        label={chapter ? `Deal me in — ${chapter.chapter.title}` : 'Deal me in'}
        glyph="♠"
        onPress={startNextLesson}
        glow
        style={styles.cta}
      />

      <View style={styles.quickGrid}>
        <Pressable onPress={() => go('path')} style={pressable(styles.quickCard, 0.99)}>
          <Suit glyph="♣" size={22} color={colors.text} />
          <Text style={styles.quickTitle}>
            {chapter ? `Unit ${chapter.index + 1} · ${chapter.chapter.title}` : 'The path'}
          </Text>
          <Text style={styles.quickSub}>
            {chapter ? `${chapter.done} of ${chapter.total} lessons` : 'No lessons yet'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => go('chips')}
          style={pressable([styles.quickCard, styles.quickCardRed], 0.99)}>
          <Suit glyph="♦" size={22} color={colors.red} />
          <Text style={styles.quickTitle}>Chips for tonight</Text>
          <Text style={styles.quickSub}>
            {players} players · {Math.round(buyIn / 100)} units in
          </Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        {HOME_STATS.map((s) => (
          <StatPill key={s.label} value={s.value} label={s.label} />
        ))}
      </View>

      <View style={styles.coachCard}>
        <Text style={styles.coachTitle}>{COACH_NOTE.title}</Text>
        <Text style={styles.coachBody}>{COACH_NOTE.body}</Text>
      </View>

      <View style={styles.weekCard}>
        <Text style={styles.weekLabel}>This week</Text>
        <View style={styles.weekChart}>
          {WEEK.map((d, i) => (
            <View key={i} style={styles.weekColumn}>
              <View style={[styles.weekBar, { height: d.height, backgroundColor: d.fill }]} />
              <Text style={styles.weekDay}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20, ...shadows.big },
  heroSuit: { position: 'absolute', right: -14, bottom: -18, lineHeight: 150 },
  heroKicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.14),
    textTransform: 'uppercase',
    color: 'rgba(240,239,233,.6)',
    marginBottom: 10,
  },
  /** the design caps the title at 16ch */
  heroTitle: { marginBottom: 16, maxWidth: 300 },
  heroBar: { marginBottom: 9 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  heroFooterText: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: 'rgba(240,239,233,.65)',
  },
  cta: { marginTop: 14 },
  quickGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickCard: {
    flex: 1,
    borderRadius: radius.smallCard,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
    ...shadows.row,
  },
  quickCardRed: { backgroundColor: colors.redTintDeep },
  quickTitle: { fontFamily: font.bold, fontSize: 13, lineHeight: 15, color: colors.text },
  quickSub: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  coachCard: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: colors.redTintDeep,
    borderWidth: 2,
    borderColor: colors.redBorder,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  coachTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    lineHeight: 15 * 1.25,
    color: colors.text,
    marginBottom: 6,
  },
  coachBody: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.redBody,
  },
  weekCard: {
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...shadows.row,
  },
  weekLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  weekChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, height: 74 },
  weekColumn: { flex: 1, alignItems: 'center', gap: 6 },
  weekBar: { width: '100%', borderRadius: 8 },
  weekDay: { fontFamily: font.regular, fontSize: 9, lineHeight: 11, color: colors.textMuted },
});
