import { PlayTTColors } from '@/constants/playtt-tokens';

export const Colors = {
  light: {
    text: PlayTTColors.productForeground,
    background: PlayTTColors.productBackground,
    tint: PlayTTColors.primary,
    icon: PlayTTColors.productMuted,
    tabIconDefault: PlayTTColors.productMuted,
    tabIconSelected: PlayTTColors.primary,
  },
  dark: {
    text: PlayTTColors.foreground,
    background: PlayTTColors.background,
    tint: PlayTTColors.primary,
    icon: PlayTTColors.mutedText,
    tabIconDefault: PlayTTColors.mutedText,
    tabIconSelected: PlayTTColors.primary,
  },
};
