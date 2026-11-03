import { useState, type ReactNode, type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AuthGlass } from '@/components/auth/auth-glass';
import { FADE_QUICK } from '@/constants/motion';
import type { AuthThemeColors } from '@/constants/auth-theme';
import { typeStyle } from '@/constants/type';

/** Inset-grouped fields on glass, like Apple's own sign-in forms. */
export function AuthFieldGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AuthGlass />
      {children}
    </View>
  );
}

type AuthRowProps = TextInputProps & {
  theme: AuthThemeColors;
  icon: (props: { color: string }) => ReactNode;
  accessibilityLabel: string;
  trailing?: ReactNode;
  error?: string;
  /** Lets the form move focus to the next field. */
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  /** The first row has no hairline above it. */
  first?: boolean;
};

export function AuthRow({ theme, icon, trailing, error, inputRef, first = false, onFocus, onBlur, style, ...props }: AuthRowProps) {
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const glow = useSharedValue(0);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const iconColor = error ? theme.destructive : focused ? theme.foreground : theme.muted;

  return (
    <View>
      {first ? null : <View style={[styles.hairline, { backgroundColor: theme.divider }]} />}
      <View style={styles.row}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.focusFill, glowStyle]} />
        <View style={styles.icon}>{icon({ color: iconColor })}</View>
        <TextInput
          ref={inputRef}
          autoCorrect={false}
          spellCheck={false}
          {...props}
          maxFontSizeMultiplier={1.4}
          placeholderTextColor={theme.muted}
          selectionColor={theme.primary}
          keyboardAppearance="dark"
          onFocus={(event) => {
            setFocused(true);
            glow.set(withTiming(1, reducedMotion ? FADE_QUICK : { duration: 180 }));
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            glow.set(withTiming(0, FADE_QUICK));
            onBlur?.(event);
          }}
          style={[styles.input, { color: theme.foreground }, style]}
        />
        {trailing}
      </View>
      {error ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(180)}
          exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          layout={reducedMotion ? undefined : LinearTransition}>
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.destructive }]}>
            {error}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(181, 230, 255, 0.45)',
    overflow: 'hidden',
  },
  row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8 },
  focusFill: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  icon: { width: 26, alignItems: 'flex-start' },
  input: { flex: 1, ...typeStyle('body'), minHeight: 50, paddingVertical: 0, paddingRight: 8 },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: 44, opacity: 0.7 },
  error: { ...typeStyle('footnote', '500'), paddingHorizontal: 18, paddingBottom: 10, marginTop: -4 },
});
