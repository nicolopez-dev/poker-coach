import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { Pop, Rise } from '../components/anim';
import { Avatar } from '../components/Avatar';
import { LegalLinks } from '../components/LegalLinks';
import { ChipDisc, RankChip } from '../components/RankChip';
import { TabScreen } from '../components/TabScreen';
import { OutlineButton, PENDING, ProgressBar } from '../components/ui';
import { currentChapter } from '../content/progress';
import {
  RANKS,
  levelLabel,
  nextRankFrom,
  rankIndexFor,
  rankPct,
  shownRankIndex,
} from '../data/ranks';
import { fmt, POINTS_PER_UNIT } from '../lib/balance';
import { gameDate, gameDetail } from '../lib/games';
import { exportData } from '../server/account';
import { useProgress, useStore } from '../state/store';
import { colors, font, ls, radius, shadows, TOUCH } from '../theme/tokens';
import { DeleteAccountSheet } from './DeleteAccountSheet';

export function YouScreen() {
  const {
    xp,
    streak,
    longestStreak,
    accuracy,
    games,
    recentGames,
    gamesLoaded,
    hydrated,
    gamesOpen,
    toggleGames,
    loadGame,
    displayName,
    avatarId,
  } = useStore();
  const { signOut, goTo } = useAuth();
  const progress = useProgress();

  // The account controls own their own state: none of this outlives the screen, and
  // none of it is anybody else's business — the store holds what the player *is*, not
  // what a sheet is doing.
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * The share sheet is the confirmation, so a success says nothing: the file is already
   * on its way, or they closed the sheet, which is an answer too. Only a failure needs
   * words.
   */
  async function exportNow() {
    if (exporting) return;
    setExportError(null);
    setExporting(true);
    const outcome = await exportData();
    if (!outcome.ok) setExportError(outcome.message);
    setExporting(false);
  }

  // "Unit 3 · 7-day streak" — the same unit the Path and Home headers name, and the
  // streak the header pill shows, rather than the handoff's invented "Friday-night
  // regular". A run of nothing says so instead of reading "0-day streak", and a run we
  // have not heard about yet says nothing at all.
  const unit = currentChapter(progress);
  const subtitle = !hydrated
    ? 'Taking your seat'
    : [
        unit ? `Unit ${unit.index + 1}` : 'Yet to sit down',
        streak > 0 ? `${streak}-day streak` : 'No streak yet',
      ].join(' · ');

  // An account with none says so straight away, without waiting on a read that has
  // nothing to find — and a panel that has been read and came back empty says the same.
  const noGames =
    (hydrated && games === 0 && recentGames.length === 0) ||
    (gamesLoaded && recentGames.length === 0);

  // The ladder selection, and the one piece of state the handoff is emphatic about: it
  // belongs to this card alone. Home renders the live rank and must not follow it (§1.4).
  const [viewRank, setViewRank] = useState<number | null>(null);
  const [ladderOpen, setLadderOpen] = useState(false);

  const liveIndex = rankIndexFor(xp);
  const shownIndex = shownRankIndex(liveIndex, viewRank);
  const viewingPast = shownIndex !== liveIndex;
  const nextRank = nextRankFrom(liveIndex);

  const rankNote = viewingPast
    ? 'Mastered · tap your current chip to go back'
    : nextRank
      ? `${fmt(nextRank.at - xp)} XP to ${nextRank.name}`
      : 'Top of the ladder. Keep the streak honest.';

  const stats = [
    {
      value: hydrated ? fmt(xp) : PENDING,
      label: 'Total XP',
      dot: colors.green,
      note: hydrated ? RANKS[liveIndex].name : undefined,
    },
    {
      value: hydrated ? `${streak}d` : PENDING,
      label: 'Day streak',
      dot: colors.gold,
      // a lost run is still a run that happened; the best one keeps its place here
      note: hydrated && longestStreak > 0 ? `Best ${longestStreak}d` : undefined,
    },
    {
      value: hydrated ? `${Math.round(accuracy * 100)}%` : PENDING,
      label: 'Accuracy',
      dot: colors.greenLight,
      // The handoff says "Last 50 drills". `get_state()` derives accuracy from every
      // answer ever given, so that note would describe a window nothing computes.
      note: 'All answers',
    },
    {
      value: hydrated ? String(games) : PENDING,
      label: 'Games set up',
      dot: colors.textMuted,
      note: 'All time',
    },
  ];

  return (
    <>
      <TabScreen>
        <View style={styles.profile}>
          <Avatar avatarId={avatarId} name={displayName} size={60} />
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName ?? 'Your seat'}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Pressable
              onPress={() => goTo('profileSetup')}
              accessibilityRole="button"
              style={styles.edit}>
              <Text style={styles.editLabel}>Edit profile</Text>
            </Pressable>
          </View>
        </View>

        {/* One card cut by hairlines rather than four floating tiles: the inner edges get
            a rule, the outer ones do not, so the grid reads as a single object. */}
        <View style={styles.statGrid}>
          {stats.map((s, i) => (
            <View
              key={s.label}
              style={[
                styles.statCell,
                i > 1 && styles.statCellRuleTop,
                i % 2 === 1 && styles.statCellRuleLeft,
              ]}>
              <View style={styles.statHead}>
                <View style={[styles.statDot, { backgroundColor: s.dot }]} />
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statNote}>{hydrated ? (s.note ?? '') : ''}</Text>
            </View>
          ))}
        </View>

        <View style={styles.rankCard}>
          <RankChip
            rankIndex={shownIndex}
            accessibilityLabel={`${RANKS[shownIndex].name}, level ${shownIndex + 1}`}
          />
          <View style={styles.rankBody}>
            <Text style={styles.sectionLabelTight}>Your rank</Text>
            <Text style={styles.rankName}>{RANKS[shownIndex].name}</Text>
            <ProgressBar
              pct={viewingPast ? 100 : rankPct(xp)}
              height={8}
              fill={viewingPast ? colors.goldRule : colors.green}
              style={styles.rankBar}
            />
            <Text style={styles.rankNote}>{hydrated ? rankNote : PENDING}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>The chip ladder</Text>
        {/* Cleared chips, the current one, and a glimpse of the next — the rest of the
            ladder is behind "Show ladder" rather than dangling as a wall of locks. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ladderRow}>
          {RANKS.slice(0, liveIndex + 2).map((rank, i) => {
            const reached = i <= liveIndex;
            const selected = i === shownIndex;
            return (
              <Pressable
                key={rank.name}
                disabled={!reached}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !reached }}
                onPress={() => setViewRank(i === liveIndex ? null : i)}
                style={[styles.ladderCard, selected && styles.ladderCardSelected]}>
                <ChipDisc rankIndex={i} size={34} dimmed={!reached} />
                <Text style={[styles.ladderLevel, !reached && styles.ladderLocked]}>
                  {levelLabel(i)}
                </Text>
                <Text style={[styles.ladderName, !reached && styles.ladderLocked]}>
                  {rank.name}
                </Text>
                <Text style={styles.ladderMeta}>
                  {i < liveIndex
                    ? 'Cleared'
                    : reached
                      ? 'You are here'
                      : `Locked · ${fmt(rank.at)} XP`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.ladderHintRow}>
          <Pressable
            onPress={() => setLadderOpen((open) => !open)}
            accessibilityRole="button"
            style={styles.ladderHint}>
            <Text style={styles.ladderHintLabel}>
              {ladderOpen ? 'Hide ladder' : 'Show ladder'}
            </Text>
          </Pressable>
        </View>

        {ladderOpen && (
          <Pop duration={300} style={styles.ladderAll}>
            {RANKS.map((rank, i) => (
              <View
                key={rank.name}
                style={[styles.ladderAllRow, i === liveIndex && styles.ladderAllRowCurrent]}>
                <View
                  style={[
                    styles.ladderAllDot,
                    { backgroundColor: rank.swatch },
                    i > liveIndex && styles.ladderAllDotLocked,
                  ]}
                />
                <Text style={styles.ladderAllLevel}>{levelLabel(i)}</Text>
                <Text style={[styles.ladderAllName, i > liveIndex && styles.ladderLocked]}>
                  {rank.name}
                </Text>
                <Text style={styles.ladderAllState}>
                  {i < liveIndex ? 'Cleared' : i === liveIndex ? 'Current' : `${fmt(rank.at)} XP`}
                </Text>
              </View>
            ))}
          </Pop>
        )}

        <Text style={styles.sectionLabel}>Mastery</Text>
        {progress.map(({ chapter, pct }) => (
          <View key={chapter.id} style={styles.masteryRow}>
            <View style={styles.masteryHead}>
              <Text style={styles.masteryName}>{chapter.title}</Text>
              <Text style={styles.masteryPct}>{hydrated ? `${pct}%` : PENDING}</Text>
            </View>
            <ProgressBar pct={pct} height={9} />
          </View>
        ))}

        <OutlineButton
          label="Your games"
          glyph={gamesOpen ? '×' : '♠'}
          active={gamesOpen}
          onPress={toggleGames}
          style={styles.gamesToggle}
        />

        {gamesOpen && (
          <Rise duration={300} style={styles.gamesPanel}>
            <View style={styles.gamesHead}>
              <Text style={styles.gamesCount}>
                {gamesLoaded ? `Last ${recentGames.length} of ${games}` : PENDING}
              </Text>
              <Text style={styles.gamesUnits}>Balance in units</Text>
            </View>
            {noGames ? (
              <Text style={styles.gamesEmpty}>
                No games yet. Set a table up under Chips and the evening lands here.
              </Text>
            ) : !gamesLoaded ? (
              <Text style={styles.gamesEmpty}>Looking them up…</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {recentGames.map((g) => {
                  // null until somebody counts the chips; an uncounted evening says so
                  // rather than showing a nought it has not earned
                  const net = g.netPoints === null ? null : g.netPoints / POINTS_PER_UNIT;
                  return (
                    <View key={g.id} style={styles.gameRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.gameDate}>{gameDate(g.playedAt)}</Text>
                        <Text style={styles.gameDetail}>{gameDetail(g)}</Text>
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.gameNet,
                            {
                              color:
                                net === null
                                  ? colors.textFaint
                                  : net > 0
                                    ? colors.greenLight
                                    : colors.textSecondary,
                            },
                          ]}>
                          {net === null
                            ? '—'
                            : `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net).toFixed(2)}`}
                        </Text>
                        <Text style={styles.gameNetLabel}>
                          {net === null ? 'not counted' : 'units'}
                        </Text>
                      </View>
                      <OutlineButton
                        label="Reuse"
                        height={44}
                        onPress={() => loadGame(g)}
                        style={styles.reuse}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </Rise>
        )}

        {/*
          The account itself, in one quiet block. Deletion sits here in the same
          treatment as logging out rather than under a red button — Apple 5.1.1(v) asks
          for it to be reachable, not for it to be shouted, and red is spoken for by the
          chip action, hearts and the "Playing" badge. What makes it deliberate is the
          word the sheet asks to be typed.
        */}
        <View style={styles.account}>
          {/* wrapped, not passed by reference: the press event is not a sign-out scope */}
          <Pressable
            onPress={() => signOut()}
            accessibilityRole="button"
            style={styles.accountAction}>
            <Text style={styles.accountLabel}>Log out</Text>
          </Pressable>

          <Pressable
            onPress={exportNow}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityState={{ disabled: exporting, busy: exporting }}
            style={styles.accountAction}>
            <Text style={[styles.accountLabel, exporting && styles.accountLabelBusy]}>
              {exporting ? 'Gathering your data…' : 'Export my data'}
            </Text>
          </Pressable>
          {exportError && (
            <Text style={styles.accountError} accessibilityRole="alert">
              {exportError}
            </Text>
          )}

          <Pressable
            onPress={() => setConfirmingDelete(true)}
            accessibilityRole="button"
            style={styles.accountAction}>
            <Text style={styles.accountLabel}>Delete account</Text>
          </Pressable>
        </View>

        <LegalLinks style={styles.legal} />
        <View style={{ height: 20 }} />
      </TabScreen>

      {confirmingDelete && <DeleteAccountSheet onClose={() => setConfirmingDelete(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  profile: {
    borderRadius: radius.hero,
    backgroundColor: colors.surface,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadows.row,
  },
  identity: { flex: 1, minWidth: 0 },
  edit: { alignSelf: 'flex-start', paddingVertical: 6 },
  editLabel: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  name: {
    fontFamily: font.bold,
    fontSize: 23,
    lineHeight: 23 * 1.05,
    letterSpacing: ls(23, -0.02),
    color: colors.text,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 14,
    color: colors.textMuted,
    marginTop: 5,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  statCell: { width: '50%', paddingVertical: 18, paddingHorizontal: 16, gap: 7 },
  /** hairlines on the inner edges only, so the card keeps one outline */
  statCellRuleTop: { borderTopWidth: 1, borderTopColor: colors.hairlineCell },
  statCellRuleLeft: { borderLeftWidth: 1, borderLeftColor: colors.hairlineCell },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statValue: {
    fontFamily: font.bold,
    fontSize: 27,
    lineHeight: 27,
    letterSpacing: ls(27, -0.02),
    color: colors.text,
  },
  statLabel: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.14),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  /** the rank, the best run, the window a number covers */
  statNote: { fontFamily: font.regular, fontSize: 10, lineHeight: 12, color: colors.textFaint },

  rankCard: {
    marginTop: 12,
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

  ladderRow: { gap: 10, paddingVertical: 12, paddingRight: 18 },
  ladderCard: {
    width: 108,
    borderRadius: radius.row,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 13,
    gap: 9,
  },
  ladderCardSelected: { backgroundColor: colors.rewardAlt, borderColor: colors.goldRule },
  ladderLevel: {
    fontFamily: font.bold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.12),
    color: colors.gold,
  },
  ladderName: { fontFamily: font.bold, fontSize: 12, lineHeight: 12 * 1.2, color: colors.text },
  ladderMeta: { fontFamily: font.regular, fontSize: 10, lineHeight: 12, color: colors.textMuted },
  /** a rank not reached yet — the swatch dims, the words go quiet */
  ladderLocked: { color: colors.textFaint },

  ladderHintRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  ladderHint: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 2 },
  ladderHintLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.1),
    textTransform: 'uppercase',
    color: colors.gold,
  },
  ladderAll: {
    marginTop: 10,
    borderRadius: radius.row,
    backgroundColor: colors.rewardAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  ladderAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.input,
  },
  ladderAllRowCurrent: { backgroundColor: 'rgba(232,207,160,.07)' },
  ladderAllDot: { width: 11, height: 11, borderRadius: 6 },
  ladderAllDotLocked: { opacity: 0.3 },
  ladderAllLevel: {
    width: 20,
    fontFamily: font.bold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    color: colors.textMuted,
  },
  ladderAllName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.bold,
    fontSize: 12,
    lineHeight: 14,
    color: colors.text,
  },
  ladderAllState: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textMuted,
  },

  sectionLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 12,
  },
  /** the same kicker inside a card, where the section's margins would be wrong */
  sectionLabelTight: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
  masteryRow: { marginBottom: 13 },
  masteryHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  masteryName: { fontFamily: font.bold, fontSize: 12, lineHeight: 14, color: colors.text },
  masteryPct: { fontFamily: font.regular, fontSize: 12, lineHeight: 14, color: colors.textMuted },
  gamesToggle: { marginTop: 20 },
  gamesPanel: {
    marginTop: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceDeep,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  gamesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  gamesCount: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  gamesUnits: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.06),
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  gameRow: {
    borderRadius: radius.row,
    backgroundColor: colors.surface,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.row,
  },
  gamesEmpty: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.45,
    color: colors.textMuted,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  gameDate: { fontFamily: font.bold, fontSize: 13, lineHeight: 15, color: colors.text },
  gameDetail: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  gameNet: { fontFamily: font.bold, fontSize: 14, lineHeight: 16 },
  gameNetLabel: {
    fontFamily: font.regular,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.06),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 3,
  },
  reuse: { paddingHorizontal: 14 },
  account: { marginTop: 14 },
  accountAction: { minHeight: TOUCH, justifyContent: 'center' },
  accountLabel: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.08),
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  /**
   * In flight. These rows already sit at the quietest ink the app has, so working is
   * shown by lifting one step rather than dimming into nothing.
   */
  accountLabelBusy: { color: colors.textMuted },
  /** red for a failed action, as on the auth screens */
  accountError: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13 * 1.25,
    color: colors.red,
    paddingBottom: 6,
  },
  legal: { marginTop: 10, justifyContent: 'flex-start' },
});
