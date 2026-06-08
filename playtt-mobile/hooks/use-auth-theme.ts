import { AuthThemes, type AuthThemeColors } from '@/constants/auth-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAuthTheme(): AuthThemeColors {
  const scheme = useColorScheme() ?? 'light';
  return AuthThemes[scheme === 'dark' ? 'dark' : 'light'];
}
