import { AppleLogo } from 'phosphor-react-native/src/icons/AppleLogo';

import { GoogleBrandIcon } from '@/components/auth/google-brand-icon';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AuthThemeColors } from '@/constants/auth-theme';
import { AuthGlass } from '@/components/auth/auth-glass';
import { PressableScale } from '@/components/kit/pressable-scale';
import { PlayTTSpacing } from '@/constants/playtt-tokens';
import { typeStyle } from '@/constants/type';

type SocialProvider = 'google' | 'apple';

type SocialAuthButtonProps = {
  provider: SocialProvider;
  theme: AuthThemeColors;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function SocialAuthButton({
  provider,
  theme,
  onPress,
  disabled = false,
  loading = false,
}: SocialAuthButtonProps) {
  const isDisabled = disabled || loading;
  const label = provider === 'google' ? 'Google' : 'Apple';

  const isApple = provider === 'apple';
  // Apple's own guidance: a solid white button with black lettering on dark backgrounds.
  const ink = isApple ? '#000000' : theme.foreground;

  return (
    <PressableScale
      accessibilityLabel={`Continue with ${label}`}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      haptic="selection"
      style={[styles.base, isApple && styles.apple]}>
      {isApple ? null : <AuthGlass />}
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={styles.content}>
          {provider === 'google' ? (
            <GoogleBrandIcon size={20} />
          ) : (
            <AppleLogo size={22} weight="fill" color={ink} />
          )}
          <Text maxFontSizeMultiplier={1.4} style={[styles.label, { color: ink }]}>
            Continue with {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 50,
    borderRadius: 999,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(181, 230, 255, 0.45)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PlayTTSpacing.md,
  },
  apple: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    ...typeStyle('headline', '600'),
  },
});
