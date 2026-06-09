import * as Haptics from 'expo-haptics';
import { AppleLogo } from 'phosphor-react-native/src/icons/AppleLogo';
import { GoogleLogo } from 'phosphor-react-native/src/icons/GoogleLogo';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AuthThemeColors } from '@/constants/auth-theme';
import { PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from '@/constants/playtt-tokens';

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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        if (!isDisabled && process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.socialFill,
          opacity: isDisabled ? 0.45 : pressed ? 0.88 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={theme.foreground} />
      ) : (
        <View style={styles.content}>
          {provider === 'google' ? (
            <GoogleLogo size={18} weight="bold" color={theme.foreground} />
          ) : (
            <AppleLogo size={18} weight="fill" color={theme.foreground} />
          )}
          <Text style={[styles.label, { color: theme.foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 44,
    borderRadius: PlayTTRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PlayTTSpacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.medium,
  },
});
