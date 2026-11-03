import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BlurTargetView } from 'expo-blur';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { BrandMark } from '@/components/brand/brand-mark';
import { AuthBackdrop } from '@/components/auth/auth-backdrop';
import { AuthGlassContext } from '@/components/auth/auth-glass';
import { PlayTTSpacing } from '@/constants/playtt-tokens';
import { typeStyle } from '@/constants/type';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { openWebPage } from '@/lib/open-web-page';
import { PRIVACY_URL, TERMS_URL } from '@/lib/release-flags';

type AuthShellProps = {
  children: ReactNode;
  headline?: string;
  subtitle?: string;
};

export function AuthShell({
  children,
  headline = 'Your next game starts here.',
  subtitle,
}: AuthShellProps) {
  const theme = useAuthTheme();
  const reducedMotion = useReducedMotion();
  const target = useRef<View | null>(null);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const glassContext = useMemo(() => ({ target, reduceTransparency }), [reduceTransparency]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return (
    <AuthGlassContext.Provider value={glassContext}>
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        <AuthBackdrop />
      </BlurTargetView>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.statusBar} />
        {/* The scroll view makes room for the keyboard itself and brings the
            field you tap into view, with no resize of the page underneath. */}
        <View style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}>
            <View style={styles.header}>
              <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(500)}>
                <BrandMark layout="auth" appearance="dark" />
              </Animated.View>
              <Animated.View
                key={headline}
                entering={reducedMotion ? undefined : FadeInDown.duration(380).delay(80)}
                exiting={reducedMotion ? undefined : FadeOut.duration(100)}
                style={styles.titleBlock}>
                <Text maxFontSizeMultiplier={1.3} style={[styles.headline, { color: theme.foreground }]}>
                  {headline}
                </Text>
                {subtitle ? (
                  <Text maxFontSizeMultiplier={1.3} style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
                ) : null}
              </Animated.View>
            </View>

            <View style={styles.formArea}>{children}</View>

            <View style={styles.footer}>
              <Text style={[styles.legal, { color: theme.muted }]}>
                By continuing, you agree to our{' '}
                <Text accessibilityRole="link" style={styles.legalLink} onPress={() => void openWebPage(TERMS_URL)}>
                  Terms
                </Text>{' '}
                and{' '}
                <Text accessibilityRole="link" style={styles.legalLink} onPress={() => void openWebPage(PRIVACY_URL)}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
    </AuthGlassContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PlayTTSpacing.sm,
  },
  headline: {
    ...typeStyle('title1', '800'),
    textAlign: 'center',
  },
  titleBlock: { alignItems: 'center', gap: 4, marginTop: 10 },
  subtitle: {
    ...typeStyle('subheadline'),
    textAlign: 'center',
  },
  formArea: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    gap: PlayTTSpacing.md,
  },
  footer: {
    alignItems: 'center',
    gap: PlayTTSpacing.sm,
    paddingTop: PlayTTSpacing.sm,
    marginTop: 'auto',
  },
  legalLink: { textDecorationLine: 'underline', fontWeight: '600' },
  legal: {
    ...typeStyle('footnote'),
    textAlign: 'center',
    paddingHorizontal: PlayTTSpacing.md,
  },
});
