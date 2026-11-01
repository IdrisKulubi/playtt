import type { AuthThemeColors } from '@/constants/auth-theme';
import { forwardRef, useRef, useState, type ReactNode } from 'react';
import { AuthGlass } from '@/components/auth/auth-glass';
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
import { useProductTheme } from '@/hooks/use-product-theme';

type InputProps = TextInputProps & {
  hasError?: boolean;
  compact?: boolean;
  variant?: 'product' | 'auth';
  authTheme?: AuthThemeColors;
  leadingIcon?: ReactNode;
  trailingAccessory?: ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    style,
    hasError = false,
    compact = false,
    variant = 'product',
    authTheme,
    leadingIcon,
    trailingAccessory,
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
  const productTheme = useProductTheme();

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
          borderColor: isFocused ? authTheme.link : 'rgba(181, 230, 255, 0.5)',
        },
        hasError && styles.authWrapperError,
      ]
    : [
        styles.wrapper,
        { backgroundColor: productTheme.input, borderColor: productTheme.border },
        compact && styles.wrapperCompact,
        isFocused && !hasError && styles.wrapperFocused,
        hasError && styles.wrapperError,
      ];

  const inputStyle = isAuth
    ? [styles.authInput, Boolean(leadingIcon || trailingAccessory) && styles.authInputWithIcon, { color: authTheme.foreground }, style]
    : [
        styles.input,
        { color: productTheme.foreground },
        compact && styles.inputCompact,
        props.multiline && styles.inputMultiline,
        style,
      ];

  // A Pressable around a multiline TextInput steals the tap on iOS and the
  // keyboard never opens; multiline fields fill the wrapper, so they don't need it.
  const Container = props.multiline ? View : Pressable;

  return (
    <Container onPress={props.multiline ? undefined : focusInput}>
      <View pointerEvents="box-none" style={wrapperStyle}>
        {isAuth ? <AuthGlass /> : null}
        {isAuth && leadingIcon ? <View pointerEvents="none" style={styles.leadingIcon}>{leadingIcon}</View> : null}
        <TextInput
          ref={setRefs}
          placeholderTextColor={
            placeholderTextColor ?? (isAuth ? authTheme.muted : productTheme.muted)
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
        {isAuth && trailingAccessory ? <View style={styles.trailingAccessory}>{trailingAccessory}</View> : null}
      </View>
    </Container>
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
    borderRadius: PlayTTRadius.pill,
    minHeight: 54,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  authWrapperError: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderColor: '#ffb7ae',
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
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
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
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  authInputWithIcon: { flex: 1, minWidth: 0, width: undefined, paddingLeft: 12 },
  leadingIcon: { marginLeft: 20 },
  trailingAccessory: { marginRight: 6 },
});
