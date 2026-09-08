import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardBack } from '../components/CardBack';
import { RankChip } from '../components/RankChip';
import { TabScreen } from '../components/TabScreen';
import { PENDING, ProgressBar, Suit, pressable } from '../components/ui';
import { useCountdown } from '../components/useCountdown';
import { handOfTheDay } from '../content/daily';
import { currentChapter } from '../content/progress';
import { RANKS, nextRankFrom, rankIndexFor, rankPct } from '../data/ranks';
import { fmt } from '../lib/balance';
import { formatCountdown } from '../lib/hearts';
import { dayFace, dayLetter } from '../lib/week';
import { useProgress, useStore } from '../state/store';
import { colors, font, ls, radius, shadows, spacing, TOUCH } from '../theme/tokens';
import { HandOfTheDay } from './home/HandOfTheDay';
import { StreakLapseCard } from './home/StreakLapseCard';
import { StreakCard } from './home/StreakCard';

/**
 * Five drills is the day's work — the chips the streak card counts out.
 *
 * It is a **target**, not the streak rule: `complete_lesson` extends a run on the first
 * finished lesson of the day, so one drill already keeps today. Nothing on this screen
 * may say otherwise.
 */
const DAILY_GOAL = 5;

function headlineFor(done: number): string {
  const left = DAILY_GOAL - done;
  if (left <= 0) return 'Streak locked. Anything else today is profit.';
  return `${left} ${left === 1 ? 'drill' : 'drills'} left to finish today`;
}

function runLine(done: number, streak: number): string {
  if (done >= DAILY_GOAL) return "Today's work is done. Come back tomorrow to keep the run alive.";
  if (done > 0) return `Today is safe. ${DAILY_GOAL - done} to go for the full five.`;
  return streak > 0 ? 'Miss a day and the run resets. One drill keeps it.' : 'One drill starts a run.';
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
    week,
    lessonsToday,
    startNextLesson,
    go,
  } = useStore();

  const untilMidnight = useCountdown(streakAtRisk ? streakExpiresAt : null, clockOffset);
  const atRisk = streakAtRisk && untilMidnight > 0;
  const progress = useProgress();
  const chapter = hydrated ? currentChapter(progress) : undefined;

  const done = Math.min(lessonsToday, DAILY_GOAL);
  const rankIndex = rankIndexFor(xp);
  const next = nextRankFrom(rankIndex);
  const today = week[week.length - 1]?.day ?? '';
  const hand = handOfTheDay(chapter?.chapter, today);

  return (
    <TabScreen contentStyle={styles.pane}>
      <View style={styles.bleedGuard}>
        <Text style={styles.kicker}>Your run</Text>
        <View style={styles.runHead}>
          <Text style={styles.runTitle}>
            {!hydrated
              ? 'Taking your seat'
              : streak === 1
                ? '1 day at the table'
                : `${streak} days at the table`}
          </Text>
          <Suit glyph="♠" size={26} color={colors.gold} />
        </View>
        <Text style={styles.runLine}>
          {atRisk
            ? `Your ${streak}-day run ends in ${formatCountdown(untilMidnight)}. One drill keeps it.`
            : hydrated
              ? runLine(done, streak)
              : ' '}
        </Text>
      </View>

      {/* The week as a hand: a day played turns face up. What each card *is* carries no
          meaning — see `dayFace` — the row says which days you sat down. */}
      <View style={styles.week}>
        {week.map((d, i) => {
          const face = dayFace(d.day);
          const played = d.answers > 0;
          const isToday = i === week.length - 1;
          const red = face.suit === '♥' || face.suit === '♦';
          return (
            <View
              key={d.day}
              accessibilityLabel={`${dayLetter(d.day)}: ${played ? `${d.answers} answered` : 'nothing played'}`}
              style={styles.weekColumn}>
              <View
                style={[
                  styles.weekCard,
                  { borderColor: isToday ? colors.goldRule : played ? 'rgba(0,0,0,.35)' : colors.hairlineStrong },
                  played ? styles.weekCardUp : null,
                ]}>
                {!played && <CardBack radius={8} />}
                {played && (
                  <>
                    <Text
                      style={[styles.weekRank, { color: red ? colors.cardRed : colors.cardInk }]}>
                      {face.rank}
                    </Text>
                    <Suit
                      glyph={face.suit}
                      size={13}
                      color={red ? colors.cardRed : colors.cardInk}
                      style={styles.weekSuit}
                    />
                  </>
                )}
              </View>
              <Text
                style={[
                  styles.weekLabel,
                  isToday && styles.weekLabelToday,
                  !played && !isToday && styles.weekLabelQuiet,
                ]}>
                {isToday ? 'Today' : dayLetter(d.day)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.bleedGuard}>
        <StreakCard
          done={done}
          goal={DAILY_GOAL}
          headline={hydrated ? headlineFor(done) : 'Finding your place'}
          cta={
            !canPlay
              ? 'Out of hearts'
              : chapter
                ? `${done > 0 ? 'Keep dealing' : 'Deal me in'} — ${chapter.chapter.title}`
                : 'Deal me in'
          }
          onDeal={startNextLesson}
          streak={streak}
          dailyLabel={hydrated ? `${done} of ${DAILY_GOAL} drills` : PENDING}
          canPlay={canPlay}
        />

        <StreakLapseCard />

        {hand && (
          <View style={styles.hotd}>
            <HandOfTheDay hand={hand} />
          </View>
        )}

        {/* Home's rank is always the live one. The You tab's ladder retargets its own
            card and must never reach this — handoff 02 §1.4. */}
        <View style={styles.rankCard}>
          <RankChip rankIndex={rankIndex} accessibilityLabel={RANKS[rankIndex].name} />
          <View style={styles.rankBody}>
            <Text style={styles.kickerTight}>Your rank</Text>
            <Text style={styles.rankName}>{RANKS[rankIndex].name}</Text>
            <ProgressBar pct={rankPct(xp)} height={8} style={styles.rankBar} />
            <Text style={styles.rankNote}>
              {!hydrated
                ? PENDING
                : next
                  ? `${fmt(next.at - xp)} XP to ${next.name}`
                  : 'Top of the ladder. Keep the streak honest.'}
            </Text>
          </View>
        </View>

        <View style={styles.tablesHead}>
          <Text style={styles.kicker}>Pick a table</Text>
          <Pressable onPress={() => go('path')} accessibilityRole="button" style={styles.seeAll}>
            <Text style={styles.seeAllLabel}>See all</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tables}>
        {progress.map(({ chapter: c, index, done: lessonsDone, total, pct, state }) => {
          const locked = state === 'locked';
          const now = state === 'now';
          return (
            <Pressable
              key={c.id}
              onPress={() => go('path')}
              disabled={locked}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              style={[
                styles.table,
                now && styles.tableNow,
                locked && styles.tableLocked,
              ]}>
              <View style={[styles.tableGlyph, !locked && styles.tableGlyphUp]}>
                {locked ? (
                  <CardBack radius={7} />
                ) : (
                  <Suit glyph={c.glyph} size={16} color={colors.cardInk} />
                )}
              </View>
              <Text style={[styles.tableTitle, locked && styles.tableTitleLocked]}>{c.title}</Text>
              <Text style={styles.tableMeta}>
                {locked
                  ? 'Locked'
                  : state === 'done'
                    ? 'Mastered'
                    : `${lessonsDone} of ${total} lessons`}
              </Text>
              <ProgressBar pct={pct} height={6} />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.bleedGuard}>
        <Pressable
          onPress={() => go('chips')}
          accessibilityRole="button"
          style={pressable(styles.chipsStrip, 0.99)}>
          <View style={styles.chipsStripBody}>
            <Text style={styles.chipsStripTitle}>Playing tonight?</Text>
            <Text style={styles.chipsStripMeta}>
              {players} players · {Math.round(buyIn / 100)} units in
            </Text>
          </View>
          <View style={styles.chipsStripGlyph}>
            <Suit glyph="♦" size={15} color={colors.red} />
          </View>
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  /** the pane goes edge to edge; sections that need the margin ask for it */
  pane: { paddingHorizontal: 0 },
  bleedGuard: { paddingHorizontal: spacing.screen.paddingHorizontal },

  kicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.14),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 7,
  },
  kickerTight: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
  runHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  runTitle: {
    flex: 1,
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: ls(30, -0.03),
    color: colors.text,
  },
  runLine: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.textMuted,
    marginTop: 8,
  },

  week: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.screen.paddingHorizontal,
    paddingTop: 14,
    paddingBottom: 2,
  },
  weekColumn: { flex: 1, alignItems: 'center', gap: 7 },
  weekCard: {
    width: '100%',
    height: 66,
    borderRadius: 8,
    borderWidth: 1,
    padding: 5,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadows.row,
  },
  weekCardUp: { backgroundColor: colors.cardFace },
  weekRank: { fontFamily: font.bold, fontSize: 13, lineHeight: 13 },
  weekSuit: { alignSelf: 'flex-end' },
  weekLabel: {
    fontFamily: font.bold,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: ls(8, 0.06),
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  weekLabelToday: { color: colors.gold },
  weekLabelQuiet: { color: colors.textFaint },

  hotd: { marginTop: 6 },

  rankCard: {
    marginTop: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceDeep,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rankBody: { flex: 1, minWidth: 0 },
  rankName: {
    fontFamily: font.bold,
    fontSize: 18,
    lineHeight: 18 * 1.1,
    color: colors.text,
    marginBottom: 9,
  },
  rankBar: { marginBottom: 7 },
  rankNote: { fontFamily: font.regular, fontSize: 11, lineHeight: 14, color: colors.textFaint },

  tablesHead: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  seeAll: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 4, marginRight: -4 },
  seeAllLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.08),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  tables: {
    gap: 10,
    paddingHorizontal: spacing.screen.paddingHorizontal,
    paddingTop: 12,
    paddingBottom: 6,
  },
  table: {
    width: 152,
    borderRadius: radius.smallCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 9,
  },
  tableNow: { backgroundColor: colors.redTintDeep, borderColor: colors.redBorder },
  tableLocked: { backgroundColor: colors.surfaceInputAlt },
  tableGlyph: {
    width: 34,
    height: 46,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.playingCard,
  },
  tableGlyphUp: { backgroundColor: colors.cardFace },
  tableTitle: { fontFamily: font.bold, fontSize: 14, lineHeight: 14 * 1.15, color: colors.text },
  tableTitleLocked: { color: colors.textFaint },
  tableMeta: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 10 * 1.3,
    color: colors.textMuted,
  },

  chipsStrip: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: 'rgba(240,239,233,.14)',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 14,
  },
  chipsStripBody: { gap: 4, flex: 1, minWidth: 0 },
  chipsStripTitle: { fontFamily: font.bold, fontSize: 13, lineHeight: 13 * 1.15, color: colors.text },
  chipsStripMeta: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 11 * 1.2,
    color: colors.textMuted,
  },
  chipsStripGlyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.redTintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
