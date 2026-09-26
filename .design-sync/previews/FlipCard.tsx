import { FlipCard, SilverFrame, StyleSheet, Suit, Text, View, colors, font, ls, radius } from 'poker-coach';

const HEART = 180;

const cover = (
  <SilverFrame radius={radius.card} innerStyle={styles().cover}>
    <Suit glyph="♥" size={HEART} color="rgba(255,86,60,.16)" style={styles().heart} />
    <View>
      <Text style={styles().coverTitle}>Hand of the day</Text>
      <Text style={styles().coverHint}>Flip to play →</Text>
    </View>
  </SilverFrame>
);

const question = (
  <SilverFrame radius={radius.card} innerStyle={{ padding: 18 }}>
    <Text style={styles().kicker}>Hand of the day</Text>
    <Text style={styles().prompt}>
      You hold A♠ K♠ under the gun, six-handed, €200 deep. Everyone folds to you.
    </Text>
    <Text style={styles().body}>Open, limp or fold?</Text>
  </SilverFrame>
);

/** Face down: the cover is the face in flow, so the card is cover-sized. */
export const FaceDown = () => <FlipCard flipped={false} front={cover} back={question} />;

/** Turned over: the card is only as tall as the face that is showing. */
export const Turned = () => <FlipCard flipped front={cover} back={question} />;

function styles() {
  return StyleSheet.create({
    cover: { padding: 18, minHeight: 190, justifyContent: 'flex-end', overflow: 'hidden' },
    heart: { position: 'absolute', right: -10, top: '50%', marginTop: -HEART / 2, lineHeight: HEART },
    coverTitle: {
      fontFamily: font.bold,
      fontSize: 26,
      lineHeight: 26 * 1.05,
      letterSpacing: ls(26, -0.02),
      color: colors.text,
      maxWidth: 150,
      marginBottom: 10,
    },
    coverHint: {
      fontFamily: font.bold,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: ls(11, 0.1),
      textTransform: 'uppercase',
      color: colors.gold,
    },
    kicker: {
      fontFamily: font.regular,
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: ls(10, 0.14),
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: 12,
    },
    prompt: { fontFamily: font.bold, fontSize: 17, lineHeight: 17 * 1.25, color: colors.text },
    body: { fontFamily: font.regular, fontSize: 13, lineHeight: 13 * 1.45, color: colors.textSecondary, marginTop: 10 },
  });
}
