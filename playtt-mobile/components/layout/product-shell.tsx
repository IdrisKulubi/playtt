import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

type ProductShellProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function ProductShell({ title, description, children }: ProductShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.productBackground,
  },
  container: {
    flex: 1,
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: PlayTTSpacing.xs,
    marginBottom: PlayTTSpacing.lg,
  },
  backLabel: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
    marginBottom: PlayTTSpacing.sm,
  },
  description: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
});
