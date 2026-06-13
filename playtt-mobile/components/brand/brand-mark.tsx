import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PlayTTSpacing } from '@/constants/playtt-tokens';

const LOGO_ASPECT = 404 / 300;

type BrandMarkProps = {
  size?: 'default' | 'compact';
  layout?: 'horizontal' | 'auth';
};

export function BrandMark({
  size = 'default',
  layout = 'horizontal',
}: BrandMarkProps) {
  const isCompact = size === 'compact';
  const logoWidth = layout === 'auth' ? 200 : isCompact ? 140 : 168;
  const logoHeight = logoWidth / LOGO_ASPECT;

  return (
    <View style={styles.container} accessibilityRole="header">
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: logoWidth, height: logoHeight }}
        contentFit="contain"
        accessibilityLabel="PlayTT"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: PlayTTSpacing.sm,
  },
});
