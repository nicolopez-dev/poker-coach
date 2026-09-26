/**
 * The design-system surface synced to claude.ai/design (see `.design-sync/NOTES.md`).
 *
 * The shared primitives in `src/components/` plus the tokens they are built from —
 * nothing is reimplemented here, this file only chooses what is public. App-shell pieces
 * wired to the store or auth (`TabScreen`, `VerifyBanner`) stay out: they cannot render
 * without a signed-in session.
 */
export {
  AuthField,
  Brand,
  Divider,
  HeartsPill,
  NumberField,
  OutlineButton,
  PENDING,
  ProgressBar,
  RedButton,
  RewardButton,
  RewardPill,
  StatPill,
  StreakPill,
  Suit,
  SyncPill,
  pressable,
} from '../src/components/ui';
export { GoldFrame, RewardCard, Sheen, SilverFrame } from '../src/components/Gold';
export { ChipDrop, Flip, Glow, Nudge, Pop, Rise, Shake, Tilt } from '../src/components/anim';
export { AceCard } from '../src/components/AceCard';
export { Avatar } from '../src/components/Avatar';
export { BackgroundCards } from '../src/components/BackgroundCards';
export { CardBack } from '../src/components/CardBack';
export { Chip, ChipEdge } from '../src/components/Chip';
export { Felt } from '../src/components/Felt';
export { FlipCard } from '../src/components/FlipCard';
export { Header } from '../src/components/Header';
export { HeldHand } from '../src/components/HeldHand';
export { LegalLinks } from '../src/components/LegalLinks';
export { ChipDisc, RankChip } from '../src/components/RankChip';
export { SwatchPicker } from '../src/components/SwatchPicker';
export { TabBar } from '../src/components/TabBar';
export {
  ChipIcon,
  CloseIcon,
  GoogleIcon,
  HomeIcon,
  TrendingUpIcon,
  UserIcon,
} from '../src/components/icons';

// Header and TabBar read safe-area insets; a design wraps its screen in this.
export { SafeAreaProvider } from 'react-native-safe-area-context';

// The primitives the screens compose layout from, so a design is written the way the
// app is: View/Text with StyleSheet objects built from the tokens below. Animated is here
// because BackgroundCards and AceCard take Animated values.
export { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export {
  absoluteFill,
  colors,
  font,
  goldGradient,
  goldGradientLocations,
  ls,
  radius,
  rewardCardFill,
  rewardCardFillLocations,
  shadows,
  silverGradient,
  silverGradientLocations,
  spacing,
  type,
  TOUCH,
} from '../src/theme/tokens';
