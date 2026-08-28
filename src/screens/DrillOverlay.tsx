import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChipDrop, Flip, Pop, Rise, Shake } from '../components/anim';
import { Felt } from '../components/Felt';
import { CloseIcon } from '../components/icons';
import { HeartsPill, RewardButton, Suit, pressable } from '../components/ui';
import { COURSE } from '../content/course';
import { drillKicker, findLesson, isDrill } from '../content/progress';
import { XP_PER_ANSWER, type FaceCard } from '../content/types';
import { useStore } from '../state/store';
import { colors, font, ls, radius, shadows, spacing, type } from '../theme/tokens';

/** The drill: one question at a time, one answer each, locked once chosen. */
export function DrillOverlay() {
  const { activeLesson, qi, chosen, hearts, drillDone, gained, pick, nextQuestion, closeDrill } =
    useStore();
  const insets = useSafeAreaInsets();

  const lesson = findLesson(COURSE, activeLesson);
  const chapterIndex = COURSE.findIndex((c) => c.id === activeLesson?.chapterId);
  const chapter = COURSE[chapterIndex];

  // Table lessons (beating a table of AI players) are future scope; until they
  // land, anything that isn't a drill shows the placeholder below.
  if (!isDrill(lesson)) {
    return <LessonPlaceholder title={lesson?.title} onClose={closeDrill} />;
  }

  const questions = lesson.questions;
  const question = questions[qi];
  const answered = chosen !== null;
  const right = answered && chosen === question.correct;
  const last = qi >= questions.length - 1;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Felt />
      <Rise duration={300} style={styles.flex}>
        <View style={[styles.column, { paddingTop: insets.top }]}>
          <View style={styles.topRow}>
            <Pressable
              onPress={closeDrill}
              accessibilityRole="button"
              accessibilityLabel="Close drill"
              style={styles.close}>
              <CloseIcon color={colors.text} />
            </Pressable>
            <View style={styles.segments}>
              {questions.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.segment,
                    {
                      backgroundColor:
                        i < qi ? colors.text : i === qi ? colors.red : colors.track,
                    },
                  ]}
                />
              ))}
            </View>
            <HeartsPill hearts={hearts} />
          </View>

          {drillDone ? (
            <Pop duration={400} style={styles.done}>
              <Suit glyph="♠" size={64} color={colors.green} style={{ marginBottom: 14 }} />
              <Text style={styles.doneKicker}>Hand played</Text>
              <Text style={[type.bigNumber, { marginBottom: 10 }]}>+{gained} XP</Text>
              <Text style={styles.doneNote}>
                {gained === questions.length * XP_PER_ANSWER
                  ? `Clean sweep. One more session and ${chapter?.title ?? 'this unit'} is yours.`
                  : 'The ones you missed come back tomorrow.'}
              </Text>
              <RewardButton label="Back to today" glyph="♥" onPress={closeDrill} />
            </Pop>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.questionScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Flip index={qi} style={styles.questionBody}>
                <View style={styles.kickerChip}>
                  <Text style={styles.kickerLabel}>
                    {drillKicker(chapterIndex, chapter?.title ?? '', qi, questions.length)}
                  </Text>
                </View>
                <Text style={styles.prompt}>{question.prompt}</Text>
                {question.cards && question.cards.length > 0 && (
                  <>
                    <View style={styles.fan}>
                      {question.cards.map((c, i) => (
                        <ChipDrop key={i} duration={400} replayKey={qi}>
                          <PlayingCard card={c} />
                        </ChipDrop>
                      ))}
                    </View>
                    <Text style={styles.fanLabel}>{question.cardsLabel}</Text>
                  </>
                )}
                <Text style={styles.context}>{question.context}</Text>
              </Flip>

              <View style={styles.spacer} />

              <View style={styles.answers}>
                {question.options.map((o) => {
                  const isCorrect = o.id === question.correct;
                  const isPicked = o.id === chosen;
                  const body = (
                    <Pressable
                      onPress={() => pick(o.id)}
                      disabled={answered}
                      accessibilityRole="button"
                      style={[
                        styles.answer,
                        {
                          backgroundColor: !answered
                            ? colors.surface
                            : isCorrect
                              ? colors.reward
                              : isPicked
                                ? colors.surfaceInput
                                : colors.surfaceMutedRow,
                          borderColor: !answered
                            ? 'transparent'
                            : isCorrect
                              ? colors.goldRule
                              : isPicked
                                ? colors.text
                                : 'transparent',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.answerLabel,
                          {
                            color: !answered
                              ? colors.text
                              : isCorrect
                                ? colors.textOnReward
                                : isPicked
                                  ? colors.text
                                  : colors.textFaint,
                          },
                        ]}>
                        {o.label}
                      </Text>
                      {answered && (isCorrect || isPicked) ? (
                        <Suit
                          glyph={isCorrect ? '♠' : '♥'}
                          size={16}
                          color={isCorrect ? colors.gold : colors.red}
                        />
                      ) : null}
                    </Pressable>
                  );

                  if (answered && isCorrect) {
                    return (
                      <Pop key={o.id} replayKey={`${qi}-${chosen}`}>
                        {body}
                      </Pop>
                    );
                  }
                  if (answered && isPicked) {
                    return (
                      <Shake key={o.id} replayKey={`${qi}-${chosen}`}>
                        {body}
                      </Shake>
                    );
                  }
                  return <View key={o.id}>{body}</View>;
                })}

                {answered && (
                  <>
                    <Rise
                      duration={300}
                      replayKey={`${qi}-${chosen}`}
                      style={[
                        styles.feedback,
                        {
                          backgroundColor: right ? colors.reward : colors.surfaceInput,
                          borderColor: right ? colors.goldRule : 'transparent',
                        },
                      ]}>
                      <View style={styles.feedbackHead}>
                        <Suit
                          glyph={right ? '♠' : '♥'}
                          size={18}
                          color={right ? colors.gold : colors.text}
                        />
                        <Text
                          style={[
                            styles.feedbackTitle,
                            { color: right ? colors.gold : colors.text },
                          ]}>
                          {right ? 'Nice hand' : 'Not quite — look again'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.feedbackBody,
                          { color: right ? colors.textOnReward : colors.text },
                        ]}>
                        {question.why}
                      </Text>
                    </Rise>

                    <Rise duration={350} replayKey={`${qi}-${chosen}`}>
                      <Pressable
                        onPress={nextQuestion}
                        accessibilityRole="button"
                        style={pressable(styles.next, 0.99)}>
                        <Text style={styles.nextLabel}>
                          {last ? 'Finish the hand' : 'Next one'}
                        </Text>
                        <View style={styles.nextCircle}>
                          <Suit glyph="♣" size={15} color={colors.text} />
                        </View>
                      </Pressable>
                    </Rise>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Rise>
    </View>
  );
}

/**
 * Anything that isn't a multiple-choice drill — today only a table lesson,
 * which is future scope. Keeps the overlay total over the lesson union.
 */
function LessonPlaceholder({ title, onClose }: { title?: string; onClose: () => void }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Felt />
      <Rise duration={300} style={styles.flex}>
        <View style={[styles.column, styles.done]}>
          <Suit glyph="♠" size={64} color={colors.green} style={{ marginBottom: 14 }} />
          <Text style={styles.doneKicker}>Not dealt yet</Text>
          <Text style={[type.sectionHeading, { marginBottom: 10 }]}>
            {title ?? 'This lesson'} is still being written.
          </Text>
          <Text style={styles.doneNote}>
            Table practice against AI players is coming. Until then, the drills are where the
            work happens.
          </Text>
          <RewardButton label="Back to today" glyph="♥" onPress={onClose} />
        </View>
      </Rise>
    </View>
  );
}

function PlayingCard({ card }: { card: FaceCard }) {
  const red = card.suit === '♥' || card.suit === '♦';
  const ink = red ? colors.cardRed : colors.cardInk;
  return (
    <View style={[styles.card, { marginTop: card.offset ?? 0 }]}>
      <Text style={[styles.cardRank, { color: ink }]}>{card.rank}</Text>
      <Suit glyph={card.suit} size={16} color={ink} style={styles.cardSuit} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 20, backgroundColor: colors.ground },
  flex: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: spacing.maxContentWidth, alignSelf: 'center' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 9, borderRadius: radius.pill },

  questionScroll: { flexGrow: 1 },
  questionBody: { paddingTop: 6, paddingHorizontal: 18 },
  spacer: { flex: 1, minHeight: 12 },
  kickerChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInput,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  kickerLabel: {
    fontFamily: font.bold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: ls(9, 0.1),
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  prompt: {
    fontFamily: font.bold,
    fontSize: 23,
    lineHeight: 23 * 1.12,
    letterSpacing: ls(23, -0.02),
    color: colors.text,
    marginBottom: 16,
  },
  fan: { flexDirection: 'row', gap: 7, marginBottom: 9, alignItems: 'flex-start' },
  fanLabel: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.08),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 16,
  },
  context: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  card: {
    width: 52,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.cardFace,
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    ...shadows.playingCard,
  },
  cardRank: { fontFamily: font.bold, fontSize: 17, lineHeight: 19 },
  cardSuit: { alignSelf: 'flex-end' },

  answers: { paddingHorizontal: 18, paddingBottom: 18, gap: 9 },
  answer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: radius.row,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  answerLabel: { flex: 1, fontFamily: font.bold, fontSize: 14, lineHeight: 14 * 1.2 },
  feedback: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  feedbackTitle: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: ls(13, 0.04),
  },
  feedbackBody: { fontFamily: font.regular, fontSize: 13, lineHeight: 13 * 1.45 },
  next: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.greenDeep,
    borderRadius: radius.pill,
    paddingLeft: 20,
    paddingRight: 12,
  },
  nextLabel: { fontFamily: font.bold, fontSize: 15, lineHeight: 18, color: colors.text },
  nextCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(240,239,233,.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  done: { flex: 1, justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 18 },
  doneKicker: {
    fontFamily: font.regular,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: ls(10, 0.12),
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  doneNote: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 14 * 1.45,
    color: colors.textSecondary,
    marginBottom: 24,
  },
});
