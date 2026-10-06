import { PlayTTColors } from '@/constants/playtt-tokens';

export type AuthMode = 'sign-in' | 'sign-up';

export type AuthThemeColors = {
  pageBackground: string;
  foreground: string;
  muted: string;
  fieldFill: string;
  fieldFillFocused: string;
  socialFill: string;
  divider: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  link: string;
  statusBar: 'light' | 'dark';
};

export const AuthThemes = {
  light: {
    pageBackground: '#ffffff',
    foreground: '#0a1628',
    muted: '#6b7280',
    fieldFill: '#f2f2f2',
    fieldFillFocused: '#e8e8e8',
    socialFill: '#f2f2f2',
    divider: '#e5e5e5',
    primary: PlayTTColors.primary,
    primaryForeground: PlayTTColors.primaryForeground,
    destructive: PlayTTColors.destructive,
    link: PlayTTColors.primary,
    statusBar: 'dark',
  },
  dark: {
    pageBackground: '#031b36',
    foreground: '#f6fcff',
    muted: '#dfedf5',
    fieldFill: 'rgba(5, 63, 101, 0.6)',
    fieldFillFocused: 'rgba(5, 63, 101, 0.72)',
    socialFill: 'rgba(5, 55, 93, 0.5)',
    divider: 'rgba(191, 234, 255, 0.4)',
    primary: '#12afe3',
    primaryForeground: '#02243b',
    destructive: '#ffb7ae',
    link: '#e1f5ff',
    statusBar: 'light',
  },
} as const satisfies Record<'light' | 'dark', AuthThemeColors>;
