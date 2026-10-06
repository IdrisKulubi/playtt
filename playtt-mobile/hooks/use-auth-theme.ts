import { AuthThemes, type AuthThemeColors } from '@/constants/auth-theme';

export function useAuthTheme(): AuthThemeColors {
  return AuthThemes.dark;
}
