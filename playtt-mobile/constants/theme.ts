import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import { PlayTTColors } from '@/constants/playtt-tokens';

export type AppColorScheme = 'light' | 'dark';

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

export function resolveColorScheme(
  scheme: string | null | undefined,
): AppColorScheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function getNavigationTheme(scheme: AppColorScheme): Theme {
  const palette = Colors[scheme];

  if (scheme === 'dark') {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: PlayTTColors.primary,
        background: palette.background,
        card: PlayTTColors.card,
        text: palette.text,
        border: PlayTTColors.border,
      },
    };
  }

  return {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: PlayTTColors.primary,
      background: palette.background,
      card: PlayTTColors.productCard,
      text: palette.text,
      border: PlayTTColors.productBorder,
    },
  };
}
