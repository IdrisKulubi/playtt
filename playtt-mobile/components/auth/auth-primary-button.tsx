import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/kit/pressable-scale';
import type { AuthThemeColors } from '@/constants/auth-theme';
import { typeStyle } from '@/constants/type';

type AuthPrimaryButtonProps = {
  label: string;
  theme: AuthThemeColors;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/** The one filled button on the sign-in screens: a cyan capsule with a soft glow. */
export function AuthPrimaryButton({ label, theme, onPress, loading = false, disabled = false }: AuthPrimaryButtonProps) {
  return (
    <PressableScale
      onPress={loading ? undefined : onPress}
      disabled={disabled}
      haptic="commit"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled }}
      style={[styles.base, { backgroundColor: theme.primary }]}>
      {loading ? (
        <ActivityIndicator color={theme.primaryForeground} />
      ) : (
        <Text maxFontSizeMultiplier={1.4} style={[styles.label, { color: theme.primaryForeground }]}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 52,
    borderRadius: 999,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12afe3',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  label: {
    ...typeStyle('headline', '700'),
  },
});
