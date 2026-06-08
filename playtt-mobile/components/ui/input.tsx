import type { AuthThemeColors } from '@/constants/auth-theme';
import { forwardRef, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type InputProps = TextInputProps & {
  hasError?: boolean;
  compact?: boolean;
  variant?: 'product' | 'auth';
  authTheme?: AuthThemeColors;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    style,
    hasError = false,
    compact = false,
    variant = 'product',
    authTheme,
    placeholderTextColor,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isAuth = variant === 'auth' && authTheme;

  function setRefs(instance: TextInput | null) {
    inputRef.current = instance;
    if (typeof ref === 'function') {
      ref(instance);
    } else if (ref) {
      ref.current = instance;
    }
  }

  function focusInput() {
    inputRef.current?.focus();
  }

  const wrapperStyle = isAuth
    ? [
        styles.authWrapper,
        {
          backgroundColor: isFocused
            ? authTheme.fieldFillFocused
            : authTheme.fieldFill,
        },
        hasError && styles.authWrapperError,
      ]
    : [
        styles.wrapper,
        compact && styles.wrapperCompact,
        isFocused && !hasError && styles.wrapperFocused,
        hasError && styles.wrapperError,
      ];

  const inputStyle = isAuth
    ? [styles.authInput, { color: authTheme.foreground }, style]
    : [styles.input, compact && styles.inputCompact, style];

  return (
    <Pressable onPress={focusInput}>
      <View pointerEvents="box-none" style={wrapperStyle}>
        <TextInput
          ref={setRefs}
          placeholderTextColor={
            placeholderTextColor ?? (isAuth ? authTheme.muted : PlayTTColors.productMuted)
          }
          style={inputStyle}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderColor: PlayTTColors.productBorder,
    backgroundColor: PlayTTColors.productInput,
    borderRadius: PlayTTRadius.field,
    minHeight: 52,
  },
  wrapperCompact: {
    minHeight: 44,
    borderRadius: PlayTTRadius.lg,
    borderWidth: 1,
  },
  wrapperFocused: {
    borderColor: PlayTTColors.primary,
    shadowColor: PlayTTColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  wrapperError: {
    borderColor: PlayTTColors.destructive,
    shadowOpacity: 0,
    elevation: 0,
  },
  authWrapper: {
    borderRadius: PlayTTRadius.md,
    minHeight: 44,
  },
  authWrapperError: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  input: {
    ...PlayTTTypography.body,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productForeground,
    width: '100%',
    minHeight: 52,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm + 2,
  },
  inputCompact: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 44,
    paddingHorizontal: PlayTTSpacing.sm + 4,
    paddingVertical: PlayTTSpacing.xs + 2,
  },
  authInput: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.regular,
    width: '100%',
    minHeight: 44,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
});
