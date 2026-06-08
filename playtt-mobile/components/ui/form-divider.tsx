import type { AuthThemeColors } from '@/constants/auth-theme';
import { StyleSheet, Text, View } from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type FormDividerProps = {
  label: string;
  compact?: boolean;
  variant?: 'product' | 'auth';
  authTheme?: AuthThemeColors;
};

export function FormDivider({
  label,
  compact = false,
  variant = 'product',
  authTheme,
}: FormDividerProps) {
  const isAuth = variant === 'auth' && authTheme;
  const lineColor = isAuth ? authTheme.divider : PlayTTColors.productBorder;
  const labelColor = isAuth ? authTheme.muted : PlayTTColors.productMuted;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.line, { backgroundColor: lineColor }]} />
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
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
    height: 1,
  },
  label: {
    ...PlayTTTypography.label,
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.regular,
    letterSpacing: 0.2,
  },
});
