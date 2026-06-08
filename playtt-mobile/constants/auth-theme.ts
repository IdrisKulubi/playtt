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
    pageBackground: '#191919',
    foreground: '#ffffff',
    muted: '#9b9b9b',
    fieldFill: '#2f2f2f',
    fieldFillFocused: '#3a3a3a',
    socialFill: '#2f2f2f',
    divider: '#3a3a3a',
    primary: PlayTTColors.primary,
    primaryForeground: PlayTTColors.primaryForeground,
    destructive: PlayTTColors.destructive,
    link: PlayTTColors.primary,
    statusBar: 'light',
  },
} as const satisfies Record<'light' | 'dark', AuthThemeColors>;
