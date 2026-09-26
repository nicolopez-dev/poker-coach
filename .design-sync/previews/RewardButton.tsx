import { RewardButton, colors } from 'poker-coach';

const noop = () => {};

/** The drill result CTA — the default size, a heart in the circle. */
export const BackToToday = () => <RewardButton label="Back to today" glyph="♥" onPress={noop} />;

/** With `glow`: the one CTA on a screen that should pull the eye (Out of hearts). */
export const Glowing = () => <RewardButton label="Deal me in" glyph="♠" onPress={noop} glow />;

/** The form size the auth screens use: 54 high, a gold pip in a 36 circle. */
export const FormSubmit = () => (
  <RewardButton
    label="Log in"
    glyph="♠"
    glyphColor={colors.gold}
    height={54}
    circleSize={36}
    onPress={noop}
  />
);

/** A form in flight: dimmed, label swapped, press ignored. */
export const Submitting = () => (
  <RewardButton
    label="Dealing…"
    glyph="♠"
    glyphColor={colors.gold}
    height={54}
    circleSize={36}
    disabled
    onPress={noop}
  />
);
