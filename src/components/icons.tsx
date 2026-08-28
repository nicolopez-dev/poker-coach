import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Lucide icon set, inlined: stroke-width 2, round caps. */
type IconProps = { size?: number; color: string };

export function HomeIcon({ size = 19, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

export function TrendingUpIcon({ size = 19, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 7h6v6" />
      <Path d="m22 7-8.5 8.5-5-5L2 17" />
    </Svg>
  );
}

/** The chip mark: concentric circles with edge ticks. */
export function ChipIcon({ size = 19, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  );
}

export function UserIcon({ size = 19, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  );
}

export function CloseIcon({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Path d="M18 6 6 18" />
      <Path d="M6 6l12 12" />
    </Svg>
  );
}

/** The official four-colour Google mark. */
export function GoogleIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-4.9 3.4-8.5z"
        fill="#4285f4"
      />
      <Path
        d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.6-2-6.5-4.8H1.7v3c1.9 3.8 5.8 6.4 10.3 6.4z"
        fill="#34a853"
      />
      <Path d="M5.5 14.1a7.1 7.1 0 0 1 0-4.5v-3H1.7a11.6 11.6 0 0 0 0 10.5l3.8-3z" fill="#fbbc05" />
      <Path
        d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.3 15.1.3 12 .3 7.5.3 3.6 2.9 1.7 6.7l3.8 2.9C6.4 6.8 9 4.8 12 4.8z"
        fill="#ea4335"
      />
    </Svg>
  );
}
