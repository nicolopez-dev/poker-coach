import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { TabScreen } from '../components/TabScreen';
import { ProgressBar, Suit } from '../components/ui';
import { isPlayable, nextLessonOf, type ChapterProgress } from '../content/progress';
import { useProgress, useStore } from '../state/store';
import { absoluteFill, colors, font, ls, radius, shadows, type } from '../theme/tokens';

/** Badge copy per chapter state. */
const BADGE: Record<ChapterProgress['state'], string> = {
  done: 'Mastered',
  now: 'Playing',
  next: 'Up next',
  locked: 'Locked',
};

/** The course. Chapters with no lessons written yet are locked, and inert. */
export function PathScreen() {
  const { completedLessons, startLesson } = useStore();
  const progress = useProgress();

  return (
    <TabScreen>
      <Text style={type.screenTitle}>Hold'em, one habit at a time</Text>
      <Text style={styles.sub}>Five drills a day. No lectures.</Text>
      {progress.map((chapter) => (
        <ChapterRow
          key={chapter.chapter.id}
          progress={chapter}
          onPress={() => startLesson(nextLessonOf(chapter.chapter, completedLessons))}
        />
      ))}
    </TabScreen>
  );
}

function ChapterRow({
  progress,
  onPress,
}: {
  progress: ChapterProgress;
  onPress: () => void;
}) {
  const { chapter, state, pct } = progress;
  const open = isPlayable(state) && chapter.lessons.length > 0;
  const current = state === 'now';
  const faceUp = state === 'done' || current;
  const red = chapter.glyph === '♥' || chapter.glyph === '♦';

  const rowBg = current ? colors.redTintDeep : open ? colors.surface : colors.surfaceLocked;
  const badgeBg = current ? colors.red : state === 'done' ? colors.greenMid : colors.track;
  const badgeInk = current || state === 'done' ? colors.text : colors.textMuted;

  return (
    <Pressable
      onPress={open ? onPress : undefined}
      disabled={!open}
      accessibilityRole="button"
      accessibilityState={{ disabled: !open }}
      style={[styles.row, { backgroundColor: rowBg }, open && shadows.row]}>
      <View style={styles.tileWrap}>
        {faceUp ? (
          <View style={[styles.tile, styles.tileFace]}>
            <Suit glyph={chapter.glyph} size={19} color={red ? colors.cardRed : colors.cardInk} />
          </View>
        ) : (
          <CardBack glyph={chapter.glyph} />
        )}
        {current && (
          <View style={styles.dealer}>
            <Text style={styles.dealerLabel}>D</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[type.rowTitle, !open && { color: colors.textFaint }]}>{chapter.title}</Text>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeLabel, { color: badgeInk }]}>{BADGE[state]}</Text>
          </View>
        </View>
        <Text style={styles.rowSub}>{chapter.sub}</Text>
        <ProgressBar pct={pct} height={8} style={styles.rowBar} />
      </View>
    </Pressable>
  );
}

/** Locked units show a card back: 5px diagonal stripes at 45°. */
function CardBack({ glyph }: { glyph: string }) {
  return (
    <View style={[styles.tile, styles.tileBack]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern
            id="cardback"
            patternUnits="userSpaceOnUse"
            width={10}
            height={10}
            patternTransform="rotate(45)">
            <Rect x={0} y={0} width={5} height={10} fill={colors.greenMid} />
            <Rect x={5} y={0} width={5} height={10} fill={colors.greenDeep} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#cardback)" />
      </Svg>
      <Suit glyph={glyph} size={19} color="rgba(240,239,233,.55)" />
    </View>
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
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 10,
  },
  tileWrap: { width: 42, height: 58 },
  tile: {
    ...absoluteFill,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
  },
  tileFace: { backgroundColor: colors.cardFace, borderColor: 'rgba(0,0,0,.35)' },
  tileBack: { backgroundColor: colors.greenDeep, borderColor: 'rgba(240,239,233,.25)' },
  dealer: {
    position: 'absolute',
    right: -9,
    bottom: -7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardFace,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.dealerButton,
  },
  dealerLabel: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, color: colors.cardInk },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9 },
  badgeLabel: {
    fontFamily: font.bold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.08),
    textTransform: 'uppercase',
  },
  rowSub: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 12 * 1.35,
    color: colors.textMuted,
    marginTop: 5,
  },
  rowBar: { marginTop: 11 },
});
