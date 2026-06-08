import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type BrandMarkProps = {
  size?: 'default' | 'compact';
  tone?: 'dark' | 'light';
  layout?: 'horizontal' | 'auth';
};

export function BrandMark({
  size = 'default',
  tone = 'dark',
  layout = 'horizontal',
}: BrandMarkProps) {
  const isCompact = size === 'compact';
  const iconSize = layout === 'auth' ? 40 : isCompact ? 36 : 44;
  const isLight = tone === 'light';

  if (layout === 'auth') {
    return (
      <View style={styles.authContainer} accessibilityRole="header">
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: iconSize, height: iconSize, borderRadius: 10 }}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityRole="header">
      <View
        style={[
          styles.monogram,
          isLight && styles.monogramLight,
          { width: iconSize, height: iconSize, borderRadius: iconSize / 2 },
        ]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: iconSize, height: iconSize }}
          contentFit="cover"
        />
      </View>
      <Text
        style={[
          styles.wordmark,
          isLight && styles.wordmarkLight,
          isCompact && styles.wordmarkCompact,
        ]}>
        PLAYTT
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PlayTTSpacing.sm,
  },
  authContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PlayTTColors.border,
  },
  monogramLight: {
    borderColor: PlayTTColors.productBorder,
  },
  wordmark: {
    ...PlayTTTypography.title,
    fontFamily: PlayTTFontFamilies.bold,
    color: PlayTTColors.foreground,
    letterSpacing: 2,
  },
  wordmarkLight: {
    color: PlayTTColors.productForeground,
  },
  wordmarkCompact: {
    fontSize: 16,
    letterSpacing: 1.5,
  },
});
