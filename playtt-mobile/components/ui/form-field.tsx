import type { AuthThemeColors } from '@/constants/auth-theme';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PlayTTSpacing } from '@/constants/playtt-tokens';
import { useAppTheme } from '@/hooks/use-app-theme';

type FormFieldProps = {
  label: string;
  error?: string;
  accessory?: ReactNode;
  children: ReactNode;
  /** Tighter spacing between label, field and error. */
  compact?: boolean;
  variant?: 'product' | 'auth';
  authTheme?: AuthThemeColors;
};

/**
 * Label above, field, then the error next to the problem: an icon plus words
 * (never colour alone), announced to screen readers as it appears.
 */
export function FormField({
  label,
  error,
  accessory,
  children,
  compact = false,
  variant = 'product',
  authTheme,
}: FormFieldProps) {
  const { colors } = useAppTheme();
  const isAuth = variant === 'auth' && authTheme;
  const errorColor = isAuth ? authTheme.destructive : colors.destructive;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.labelRow}>
        <AppText
          variant="subheadline"
          weight="600"
          style={[styles.label, isAuth ? { color: authTheme.foreground } : null]}
        >
          {label}
        </AppText>
        {accessory}
      </View>
      {children}
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color={errorColor} />
          <AppText variant="footnote" weight="600" style={[styles.errorText, { color: errorColor }]}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: PlayTTSpacing.xs },
  containerCompact: { gap: PlayTTSpacing['2xs'] },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PlayTTSpacing.sm,
    paddingHorizontal: 2,
  },
  label: { flexShrink: 1 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: PlayTTSpacing['2xs'],
    paddingHorizontal: 2,
  },
  errorText: { flex: 1 },
});
