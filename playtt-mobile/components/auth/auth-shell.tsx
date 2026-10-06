import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BlurTargetView } from 'expo-blur';
import {
  KeyboardAvoidingView,
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BrandMark } from '@/components/brand/brand-mark';
import { AuthBackdrop } from '@/components/auth/auth-backdrop';
import { AuthGlassContext } from '@/components/auth/auth-glass';
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';

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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View style={styles.header}>
              <BrandMark layout="auth" appearance="dark" />
              <Text style={[styles.headline, { color: theme.foreground }]}>
                {headline}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
              ) : null}
            </View>

            <View style={styles.formArea}>{children}</View>

            <View style={styles.footer}>
              <Text style={[styles.legal, { color: theme.muted }]}>
                By continuing, you agree to our Terms and Privacy Policy.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    paddingTop: 48,
    paddingBottom: 24,
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PlayTTSpacing.sm,
  },
  headline: {
    ...PlayTTTypography.headline,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontFamily: PlayTTFontFamilies.semiBold,
    textAlign: 'center',
    marginTop: 32,
  },
  subtitle: {
    ...PlayTTTypography.body,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.medium,
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
    paddingTop: PlayTTSpacing.md,
    marginTop: 'auto',
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
    paddingHorizontal: PlayTTSpacing.md,
  },
});
