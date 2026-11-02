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

import { KitLayout } from '@/constants/kit-layout';
import { PlayTTRadius, PlayTTSpacing } from '@/constants/playtt-tokens';
import { typeStyle } from '@/constants/type';
import { useAppTheme } from '@/hooks/use-app-theme';

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
  const { colors } = useAppTheme();

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
        {
          backgroundColor: colors.surface,
          // Focus and error change both colour and thickness, so they don't rely on colour alone.
          borderColor: hasError ? colors.destructive : isFocused ? colors.accent : colors.separator,
          borderWidth: hasError || isFocused ? 2 : 1,
        },
        compact && styles.wrapperCompact,
      ];

  const inputStyle = isAuth
    ? [styles.authInput, Boolean(leadingIcon || trailingAccessory) && styles.authInputWithIcon, { color: authTheme.foreground }, style]
    : [
        styles.input,
        { color: colors.label },
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
            placeholderTextColor ?? (isAuth ? authTheme.muted : colors.tertiaryLabel)
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

// Body text (17 pt, system font) everywhere: fields are where people read most carefully.
const BODY = typeStyle('body');

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: KitLayout.groupRadius,
    borderCurve: 'continuous',
    minHeight: 52,
  },
  wrapperCompact: {
    minHeight: KitLayout.minTouchTarget,
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
    ...BODY,
    width: '100%',
    minHeight: 52,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputCompact: {
    minHeight: KitLayout.minTouchTarget,
    paddingVertical: PlayTTSpacing.xs,
  },
  authInput: {
    ...BODY,
    width: '100%',
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  authInputWithIcon: { flex: 1, minWidth: 0, width: undefined, paddingLeft: 12 },
  leadingIcon: { marginLeft: 20 },
  trailingAccessory: { marginRight: 6 },
});
