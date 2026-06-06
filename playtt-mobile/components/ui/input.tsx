import { forwardRef } from 'react';
import {
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
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { style, hasError = false, placeholderTextColor, ...props },
  ref,
) {
  return (
    <View style={[styles.wrapper, hasError && styles.wrapperError]}>
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor ?? PlayTTColors.productMuted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    backgroundColor: PlayTTColors.productInput,
    borderRadius: PlayTTRadius.field,
    minHeight: 48,
    justifyContent: 'center',
  },
  wrapperError: {
    borderColor: PlayTTColors.destructive,
  },
  input: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productForeground,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
});
