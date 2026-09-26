import { ProgressBar, Text, View, colors, type } from 'poker-coach';

/** The rank bar on Home: 8 high, green fill on the track. */
export const Rank = () => (
  <View style={{ gap: 8 }}>
    <Text style={type.kicker}>Rank · Regular</Text>
    <ProgressBar pct={62} height={8} />
    <Text style={type.bodySmall}>380 xp to Shark</Text>
  </View>
);

/** The thin bar under a lesson tile, at three points in a chapter. */
export const LessonTiles = () => (
  <View style={{ gap: 14 }}>
    <ProgressBar pct={0} height={6} />
    <ProgressBar pct={40} height={6} />
    <ProgressBar pct={100} height={6} />
  </View>
);

/** Fill and track are props — the light green on a deeper track. */
export const CustomColours = () => (
  <ProgressBar pct={75} height={8} fill={colors.greenLight} track={colors.surfaceDeep} />
);
