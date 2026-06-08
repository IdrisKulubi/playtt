import type { AuthThemeColors } from '@/constants/auth-theme';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type ButtonVariant = 'primary' | 'outline' | 'ghost';
type ButtonSurface = 'marketing' | 'product' | 'auth';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  surface?: ButtonSurface;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  authTheme?: AuthThemeColors;
};

export function Button({
  label,
  variant = 'primary',
  surface = 'marketing',
  loading = false,
  fullWidth = true,
  compact = false,
  authTheme,
  disabled,
  onPress,
  onPressIn,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isAuth = surface === 'auth' && authTheme;

  const outlineStyle = surface === 'product' ? styles.outlineProduct : styles.outlineMarketing;
  const outlineLabelStyle =
    surface === 'product' ? styles.labelOutlineProduct : styles.labelOutlineMarketing;
  const spinnerColor = isAuth
    ? variant === 'primary'
      ? authTheme.primaryForeground
      : authTheme.foreground
    : variant === 'primary'
      ? PlayTTColors.primaryForeground
      : surface === 'product'
        ? PlayTTColors.productForeground
        : PlayTTColors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={(event) => {
        if (!isDisabled && process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.baseCompact,
        isAuth && styles.authBase,
        isAuth && variant === 'primary' && { backgroundColor: authTheme.primary },
        !isAuth && variant === 'primary' && styles.primary,
        !isAuth && variant === 'outline' && outlineStyle,
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.label,
            compact && styles.labelCompact,
            isAuth && variant === 'primary' && { color: authTheme.primaryForeground },
            isAuth && variant !== 'primary' && { color: authTheme.foreground },
            !isAuth && variant === 'primary' && styles.labelPrimary,
            !isAuth && variant === 'outline' && outlineLabelStyle,
            variant === 'ghost' &&
              !isAuth &&
              (surface === 'product' ? styles.labelGhostProduct : styles.labelGhostMarketing),
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: PlayTTRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBase: {
    minHeight: 44,
    borderRadius: PlayTTRadius.md,
    paddingVertical: 12,
  },
  baseCompact: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...PlayTTTypography.label,
    fontSize: 15,
    fontFamily: PlayTTFontFamilies.semiBold,
  },
  labelCompact: {
    fontSize: 14,
  },
  primary: {
    backgroundColor: PlayTTColors.primary,
  },
  outlineMarketing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PlayTTColors.border,
  },
  outlineProduct: {
    backgroundColor: PlayTTColors.productElevated,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  labelPrimary: {
    color: PlayTTColors.primaryForeground,
  },
  labelOutlineMarketing: {
    color: PlayTTColors.foreground,
  },
  labelOutlineProduct: {
    color: PlayTTColors.productForeground,
  },
  labelGhostMarketing: {
    color: PlayTTColors.foreground,
  },
  labelGhostProduct: {
    color: PlayTTColors.productForeground,
  },
});
