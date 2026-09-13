import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Nudge } from '../../components/anim';
import { CardBack } from '../../components/CardBack';
import { PENDING, ProgressBar, Suit, pressable } from '../../components/ui';
import { isPlayable, nextLessonOf, type ChapterProgress } from '../../content/progress';
import { useProgress, useStore } from '../../state/store';
import { colors, font, ls, radius, shadows } from '../../theme/tokens';

/**
 * Mastery: the course as a table of cards, two to a row.
 *
 * It used to be fourteen title-and-bar rows that said how far along each unit was and
 * nothing else — and could not be tapped, which made the one screen that shows the whole
 * course the one place you could not open any of it. The Path already carries the
 * reading: a face-up card for a unit you can sit at, a card back for one you cannot. So
 * the grid borrows that and adds the way in — a card deals the unit's next lesson,
 * exactly as the Path row does.
 *
 * Locked units answer rather than ignore. A press shakes the card and stops there, which
 * says the tap landed and the unit is shut without spending a dialog on it.
 */
export function Mastery() {
  const { completedLessons, canPlay, hydrated, startLesson } = useStore();
  const progress = useProgress();

  return (
    <View style={styles.grid}>
      {progress.map((p) => (
        <MasteryCard
          key={p.chapter.id}
          progress={p}
          blocked={!canPlay}
          hydrated={hydrated}
          onOpen={() => startLesson(nextLessonOf(p.chapter, completedLessons))}
        />
      ))}
    </View>
  );
}

function MasteryCard({
  progress,
  blocked,
  hydrated,
  onOpen,
}: {
  progress: ChapterProgress;
  /** out of hearts: nothing here can be dealt until one comes back */
  blocked: boolean;
  hydrated: boolean;
  onOpen: () => void;
}) {
  const { chapter, done, total, pct } = progress;

  // The Path's rule, kept word for word: out of hearts reads as locked, and a mastered
  // unit keeps saying mastered — it simply cannot be replayed until a heart returns.
  const state = blocked && progress.state !== 'done' ? 'locked' : progress.state;
  const open = isPlayable(state) && total > 0 && !blocked;
  const now = state === 'now';
  const mastered = state === 'done';
  const red = chapter.glyph === '♥' || chapter.glyph === '♦';

  /** bumped on every refused press, which is what replays the shake */
  const [refused, setRefused] = useState(0);

  const meta = !hydrated
    ? PENDING
    : mastered
      ? 'Mastered'
      : state === 'locked'
        ? total === 0
          ? 'Not written yet'
          : 'Locked'
        : `${done} of ${total} lessons`;

  return (
    <Nudge count={refused} style={styles.cell}>
      <Pressable
        onPress={open ? onOpen : () => setRefused((n) => n + 1)}
        accessibilityRole="button"
        // Not `disabled`: a locked card still takes the press, because the shake *is*
        // the answer. The state is what tells a screen reader the unit is shut.
        accessibilityState={{ disabled: !open }}
        accessibilityLabel={`${chapter.title}, ${meta}`}
        // a shut card does not dip under the finger; it shakes instead
        style={pressable(
          [styles.card, now && styles.cardNow, mastered && styles.cardDone, !open && styles.cardShut],
          open ? 0.98 : 1,
        )}>
        <View style={styles.head}>
          <View style={[styles.tile, open || mastered ? styles.tileUp : null]}>
            {open || mastered ? (
              <Suit glyph={chapter.glyph} size={14} color={red ? colors.cardRed : colors.cardInk} />
            ) : (
              <CardBack radius={6} />
            )}
          </View>
          <Text style={[styles.pct, mastered && styles.pctDone, !open && !mastered && styles.quiet]}>
            {hydrated ? `${pct}%` : ''}
          </Text>
        </View>

        <Text style={[styles.title, !open && !mastered && styles.quiet]} numberOfLines={2}>
          {chapter.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        <ProgressBar pct={pct} height={6} fill={mastered ? colors.goldRule : colors.green} />
      </Pressable>
    </Nudge>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  /** two to a row on a phone, and the pair keeps its ratio on a wider screen */
  cell: { flexGrow: 1, flexBasis: '46%', minWidth: 150 },
  card: {
    flex: 1,
    borderRadius: radius.smallCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: 13,
    gap: 8,
    ...shadows.row,
  },
  /** the unit being played, in the "Playing" red the Path and Home both use for it */
  cardNow: { backgroundColor: colors.redTintDeep, borderColor: colors.redBorder },
  /** finished: near-black and a gold hairline, never a green fill */
  cardDone: { borderColor: colors.goldRule },
  cardShut: { backgroundColor: colors.surfaceInputAlt },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tile: {
    width: 30,
    height: 41,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.playingCard,
  },
  tileUp: { backgroundColor: colors.cardFace },
  pct: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: ls(13, -0.01),
    color: colors.text,
  },
  pctDone: { color: colors.gold },
  title: { fontFamily: font.bold, fontSize: 13, lineHeight: 13 * 1.2, color: colors.text },
  meta: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 10 * 1.3,
    color: colors.textMuted,
  },
  /** a unit that cannot be dealt right now — the words go quiet, nothing else changes */
  quiet: { color: colors.textFaint },
});
