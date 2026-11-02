import type { AuthThemeColors } from '@/constants/auth-theme';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type FormDividerProps = {
  label: string;
  compact?: boolean;
  variant?: 'product' | 'auth';
  authTheme?: AuthThemeColors;
};

/** "or use your email" between two ways of doing the same thing. */
export function FormDivider({ label, compact = false, variant = 'product', authTheme }: FormDividerProps) {
  const { colors } = useAppTheme();
  const isAuth = variant === 'auth' && authTheme;
  const lineColor = isAuth ? authTheme.divider : colors.separator;
  const labelColor = isAuth ? authTheme.muted : colors.secondaryLabel;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.line, { backgroundColor: lineColor }]} />
      <AppText variant="footnote" style={{ color: labelColor }}>
        {label}
      </AppText>
      <View style={[styles.line, { backgroundColor: lineColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PlayTTSpacing.sm,
    paddingVertical: PlayTTSpacing['2xs'],
  },
  containerCompact: {
    paddingVertical: 0,
    gap: PlayTTSpacing.xs,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});
