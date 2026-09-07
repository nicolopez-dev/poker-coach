import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { Rise } from '../components/anim';
import { Avatar } from '../components/Avatar';
import { TabScreen } from '../components/TabScreen';
import { OutlineButton, PENDING, ProgressBar } from '../components/ui';
import { currentChapter } from '../content/progress';
import { fmt, POINTS_PER_UNIT } from '../lib/balance';
import { gameDate, gameDetail } from '../lib/games';
import { useProgress, useStore } from '../state/store';
import { colors, font, ls, radius, shadows } from '../theme/tokens';

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

  const stats = [
    {
      value: hydrated ? fmt(xp) : PENDING,
      label: 'Total XP',
      bg: colors.greenDeep,
      ink: colors.text,
    },
    {
      value: hydrated ? String(streak) : PENDING,
      label: 'Day streak',
      bg: colors.rewardAlt,
      ink: colors.gold,
      // a lost run is still a run that happened; the best one keeps its place here
      note: hydrated && longestStreak > 0 ? `Best ${longestStreak}` : undefined,
    },
    {
      value: hydrated ? `${Math.round(accuracy * 100)}%` : PENDING,
      label: 'Accuracy',
      bg: colors.surface,
      ink: colors.text,
    },
    {
      value: hydrated ? String(games) : PENDING,
      label: 'Games set up',
      bg: colors.surface,
      ink: colors.text,
    },
  ];

  return (
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

      <View style={styles.statGrid}>
        {stats.map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statValue, { color: s.ink }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
            {s.note ? <Text style={styles.statNote}>{s.note}</Text> : null}
          </View>
        ))}
      </View>

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
                      <Text style={styles.gameNetLabel}>{net === null ? 'not counted' : 'units'}</Text>
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

      {/* wrapped, not passed by reference: the press event is not a sign-out scope */}
      <Pressable onPress={() => signOut()} accessibilityRole="button" style={styles.logout}>
        <Text style={styles.logoutLabel}>Log out</Text>
      </Pressable>
      <View style={{ height: 20 }} />
    </TabScreen>
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
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.smallCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statValue: { fontFamily: font.bold, fontSize: 24, lineHeight: 26 },
  statLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.08),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 5,
  },
  /** the longest run, under its stat at the same micro scale */
  statNote: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.08),
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 3,
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
  logout: { minHeight: 44, marginTop: 14, justifyContent: 'center' },
  logoutLabel: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: ls(11, 0.08),
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
});
