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
type ButtonSurface = 'marketing' | 'product';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  surface?: ButtonSurface;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  surface = 'marketing',
  loading = false,
  fullWidth = true,
  disabled,
  onPress,
  onPressIn,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const outlineStyle = surface === 'product' ? styles.outlineProduct : styles.outlineMarketing;
  const outlineLabelStyle =
    surface === 'product' ? styles.labelOutlineProduct : styles.labelOutlineMarketing;
  const spinnerColor =
    variant === 'primary'
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
        variant === 'primary' && styles.primary,
        variant === 'outline' && outlineStyle,
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
            variant === 'primary' && styles.labelPrimary,
            variant === 'outline' && outlineLabelStyle,
            variant === 'ghost' &&
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
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: PlayTTRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
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
    backgroundColor: 'transparent',
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
