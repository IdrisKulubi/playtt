import type { AuthThemeColors } from '@/constants/auth-theme';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type FormFieldProps = {
  label: string;
  error?: string;
  accessory?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  variant?: 'product' | 'auth';
  authTheme?: AuthThemeColors;
};

export function FormField({
  label,
  error,
  accessory,
  children,
  compact = false,
  variant = 'product',
  authTheme,
}: FormFieldProps) {
  const isAuth = variant === 'auth' && authTheme;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.labelRow}>
        <Text
          style={[
            styles.label,
            compact && styles.labelCompact,
            isAuth && { color: authTheme.muted },
          ]}>
          {label}
        </Text>
        {accessory}
      </View>
      {children}
      {error ? (
        <Text
          style={[
            styles.error,
            compact && styles.errorCompact,
            isAuth && { color: authTheme.destructive },
          ]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: PlayTTSpacing.xs,
  },
  containerCompact: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PlayTTSpacing.sm,
    paddingHorizontal: 2,
  },
  label: {
    ...PlayTTTypography.label,
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  labelCompact: {
    fontSize: 12,
  },
  error: {
    ...PlayTTTypography.label,
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.destructive,
    paddingHorizontal: 2,
  },
  errorCompact: {
    fontSize: 12,
  },
});
