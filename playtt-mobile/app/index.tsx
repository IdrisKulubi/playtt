import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand/brand-mark';
import { MarketingShell } from '@/components/layout/marketing-shell';
import { Button } from '@/components/ui/button';
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';

export default function LandingScreen() {
  return (
    <MarketingShell
      header={<BrandMark />}
      footer={
        <View style={styles.footer}>
          <Button label="Book now" onPress={() => router.push('/book')} />
          <Button
            label="Create account"
            variant="outline"
            onPress={() => router.push('/sign-up')}
          />
          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account?</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/sign-in')}
              style={({ pressed }) => [styles.signInLink, pressed && styles.signInLinkPressed]}>
              {({ pressed }) => (
                <Text style={[styles.signInLinkText, pressed && styles.signInLinkTextPressed]}>
                  Sign in
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      }>
      <View style={styles.hero}>
        <View style={styles.glow} />
        <Text style={styles.headline}>Table tennis for all, booked in seconds.</Text>
        <Text style={styles.tagline}>Autonomous Table Tennis. Anytime.</Text>
      </View>
    </MarketingShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -24,
    left: -16,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: PlayTTColors.primaryGlow,
    opacity: 0.35,
  },
  headline: {
    ...PlayTTTypography.display,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
    maxWidth: 320,
  },
  tagline: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
    marginTop: PlayTTSpacing.md,
    maxWidth: 280,
  },
  footer: {
    gap: PlayTTSpacing.sm,
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: PlayTTSpacing.xs,
    paddingTop: PlayTTSpacing.xs,
  },
  signInPrompt: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  signInLink: {
    paddingVertical: PlayTTSpacing['2xs'],
    paddingHorizontal: PlayTTSpacing['2xs'],
  },
  signInLinkPressed: {
    opacity: 0.85,
  },
  signInLinkText: {
    ...PlayTTTypography.label,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  signInLinkTextPressed: {
    color: PlayTTColors.primary,
  },
});
