import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { BrandMark } from '@/components/brand/brand-mark';
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
  headline = 'Your booking space.',
  subtitle,
}: AuthShellProps) {
  const theme = useAuthTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBackground }]}>
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
              <BrandMark layout="auth" />
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
    paddingHorizontal: PlayTTSpacing.lg,
    paddingTop: PlayTTSpacing.xl,
    paddingBottom: PlayTTSpacing.lg,
    gap: PlayTTSpacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: PlayTTSpacing.md,
    paddingHorizontal: PlayTTSpacing.sm,
  },
  headline: {
    ...PlayTTTypography.headline,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: PlayTTFontFamilies.semiBold,
    textAlign: 'center',
  },
  subtitle: {
    ...PlayTTTypography.body,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: PlayTTFontFamilies.medium,
    textAlign: 'center',
  },
  formArea: {
    width: '100%',
    maxWidth: 400,
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
    fontSize: 11,
    lineHeight: 16,
    fontFamily: PlayTTFontFamilies.regular,
    textAlign: 'center',
    paddingHorizontal: PlayTTSpacing.md,
  },
});
