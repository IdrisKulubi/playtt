import type { AuthThemeColors } from '@/constants/auth-theme';
import type { ProductThemeColors } from '@/constants/product-theme';
import { AuthGlass } from '@/components/auth/auth-glass';
import { Button as KitButton } from '@/components/kit/button';
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
  /** @deprecated Product buttons render the kit button, which follows the app theme. */
  productTheme?: ProductThemeColors;
};

export function Button({
  label,
  variant = 'primary',
  surface = 'marketing',
  loading = false,
  fullWidth = true,
  compact = false,
  authTheme,
  productTheme,
  disabled,
  onPress,
  onPressIn,
  style,
  ...props
}: ButtonProps) {
  // In-app buttons now render the redesign kit button (50 pt, shared theme,
  // touch-down feedback). Sign-in ("auth") and marketing surfaces keep their own look.
  if (surface === 'product') {
    return (
      <KitButton
        label={label}
        variant={variant === 'outline' ? 'secondary' : variant === 'ghost' ? 'plain' : 'primary'}
        loading={loading}
        disabled={Boolean(disabled)}
        fullWidth={fullWidth}
        accessibilityHint={props.accessibilityHint}
        style={typeof style === 'function' ? undefined : (style as ViewStyle | undefined)}
        onPress={() => onPress?.(undefined as never)}
      />
    );
  }

  const isDisabled = disabled || loading;
  const isAuth = surface === 'auth' && authTheme;
  const spinnerColor = isAuth
    ? variant === 'primary'
      ? authTheme.primaryForeground
      : authTheme.foreground
    : variant === 'primary'
      ? PlayTTColors.primaryForeground
      : PlayTTColors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
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
        !isAuth && variant === 'outline' && styles.outlineMarketing,
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style as ViewStyle,
      ]}
      {...props}>
      {isAuth && variant === 'primary' ? <AuthGlass luminous /> : null}
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
            !isAuth && variant === 'outline' && styles.labelOutlineMarketing,
            variant === 'ghost' && !isAuth && styles.labelGhostMarketing,
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
    minHeight: 54,
    borderRadius: PlayTTRadius.pill,
    paddingVertical: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(205, 246, 255, 0.8)',
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
  ghost: {
    backgroundColor: 'transparent',
  },
  labelPrimary: {
    color: PlayTTColors.primaryForeground,
  },
  labelOutlineMarketing: {
    color: PlayTTColors.foreground,
  },
  labelGhostMarketing: {
    color: PlayTTColors.foreground,
  },
});
