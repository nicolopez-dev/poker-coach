import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Rise } from '../components/anim';
import { RewardCard } from '../components/Gold';
import { TabScreen } from '../components/TabScreen';
import { PENDING, ProgressBar, RewardButton, StatPill, Suit, pressable } from '../components/ui';
import { useCountdown } from '../components/useCountdown';
import { currentChapter } from '../content/progress';
import { COACH_NOTE } from '../data/profile';
import { fmt } from '../lib/balance';
import { formatCountdown } from '../lib/hearts';
import { barHeights, dayLetter } from '../lib/week';
import { StreakLapseCard } from './home/StreakLapseCard';
import { useProgress, useStore } from '../state/store';
import { colors, font, ls, radius, shadows, type } from '../theme/tokens';

/** Three drills is the day's work — the goal the hero counts towards. */
const DAILY_GOAL = 3;

/** The hero's line, from what has actually been played today. */
function goalCopy(done: number): { title: string; label: string } {
  const left = DAILY_GOAL - done;

  if (done === 0) return { title: 'Three drills and the day is yours', label: 'None yet today' };
  if (left === 1) return { title: 'One more drill and the day is yours', label: '2 of 3 drills' };
  if (left > 0) {
    return { title: `${left} more drills and the day is yours`, label: `${done} of 3 drills` };
  }
  return {
    title: "Today's three are done. Anything now is a bonus",
    label: `${done} of 3 drills`,
  };
}

export function HomeScreen() {
  const {
    xp,
    players,
    buyIn,
    hydrated,
    canPlay,
    streak,
    streakAtRisk,
    streakExpiresAt,
    clockOffset,
    accuracy,
    week,
    lessonsToday,
    completedLessons,
    startNextLesson,
    go,
  } = useStore();
  // The hero is the one place the at-risk state is a sentence rather than a pill: a run
  // alive but untouched today has a deadline, and saying it is more use than the
  // generic daily goal.
  const untilMidnight = useCountdown(streakAtRisk ? streakExpiresAt : null, clockOffset);
  const atRisk = streakAtRisk && untilMidnight > 0;
  const progress = useProgress();
  // Until the server answers, the course reads as untouched — which for a returning
  // player is a lie about where they are. Withhold the unit rather than name the wrong
  // one; the CTA and the card already have copy for having no chapter yet.
  const chapter = hydrated ? currentChapter(progress) : undefined;

  const goal = goalCopy(lessonsToday);
  const heights = barHeights(week.map((d) => d.answers));
  const played = week.reduce((n, d) => n + d.answers, 0);

  // Three pills, all of them real. The handoff's fourth was a "Level", which nothing in
  // the app has ever computed — inventing one from this data would be making it up.
  const stats = [
    { value: hydrated ? `${Math.round(accuracy * 100)}%` : PENDING, label: 'Sharp' },
    { value: hydrated ? String(completedLessons.length) : PENDING, label: 'Drills' },
    { value: hydrated ? String(streak) : PENDING, label: 'Streak' },
  ];

  return (
    <TabScreen>
      <Rise duration={450}>
        <RewardCard radius={radius.hero} innerStyle={styles.hero}>
          <Suit glyph="♠" size={150} color="rgba(240,239,233,.08)" style={styles.heroSuit} />
          <Text style={styles.heroKicker}>Today's hand</Text>
          <Text style={[type.heroTitle, styles.heroTitle]}>
            {atRisk
              ? `Your ${streak}-day streak ends in ${formatCountdown(untilMidnight)}`
              : goal.title}
          </Text>
          <ProgressBar
            pct={Math.min(100, (lessonsToday / DAILY_GOAL) * 100)}
            height={12}
            track="rgba(240,239,233,.18)"
            style={styles.heroBar}
          />
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>
              {atRisk ? 'One hand keeps it' : goal.label}
            </Text>
            <Text style={styles.heroFooterText}>{hydrated ? fmt(xp) : PENDING} XP</Text>
          </View>
        </RewardCard>
      </Rise>

      <StreakLapseCard />

      {/* Out of hearts the CTA stays pressable — it is how you get to the countdown —
          but it stops glowing and stops promising a lesson it cannot open. */}
      <RewardButton
        label={
          !canPlay
            ? 'Out of hearts'
            : chapter
              ? `Deal me in — ${chapter.chapter.title}`
              : 'Deal me in'
        }
        glyph={canPlay ? '♠' : '♥'}
        glyphColor={canPlay ? colors.textOnReward : colors.red}
        onPress={startNextLesson}
        glow={canPlay}
        style={styles.cta}
      />

      <View style={styles.quickGrid}>
        <Pressable onPress={() => go('path')} style={pressable(styles.quickCard, 0.99)}>
          <Suit glyph="♣" size={22} color={colors.text} />
          <Text style={styles.quickTitle}>
            {chapter ? `Unit ${chapter.index + 1} · ${chapter.chapter.title}` : 'The path'}
          </Text>
          <Text style={styles.quickSub}>
            {chapter
              ? `${chapter.done} of ${chapter.total} lessons`
              : hydrated
                ? 'No lessons yet'
                : 'Finding your place'}
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
        {stats.map((s) => (
          <StatPill key={s.label} value={s.value} label={s.label} />
        ))}
      </View>

      <View style={styles.coachCard}>
        <Text style={styles.coachTitle}>{COACH_NOTE.title}</Text>
        <Text style={styles.coachBody}>{COACH_NOTE.body}</Text>
      </View>

      {/* Seven local days ending today, scaled to the player's own busiest one. A quiet
          week keeps its columns and sits on the baseline rather than reading as broken. */}
      <View style={styles.weekCard}>
        <View style={styles.weekHead}>
          <Text style={styles.weekLabel}>This week</Text>
          <Text style={styles.weekTotal}>
            {!hydrated ? PENDING : played === 1 ? '1 hand' : `${played} hands`}
          </Text>
        </View>
        <View style={styles.weekChart}>
          {week.map((d, i) => (
            <View key={d.day} style={styles.weekColumn}>
              <View
                style={[
                  styles.weekBar,
                  {
                    height: heights[i],
                    backgroundColor: d.answers > 0 ? colors.text : colors.greenSpent,
                  },
                ]}
              />
              <Text style={[styles.weekDay, i === week.length - 1 && styles.weekToday]}>
                {dayLetter(d.day)}
              </Text>
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
  weekHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  weekTotal: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  weekChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, height: 74 },
  weekColumn: { flex: 1, alignItems: 'center', gap: 6 },
  weekBar: { width: '100%', borderRadius: 8 },
  weekDay: { fontFamily: font.regular, fontSize: 9, lineHeight: 11, color: colors.textMuted },
  /** today, so the row reads left-to-right towards now */
  weekToday: { color: colors.text },
});
