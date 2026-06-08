import type { AuthMode } from '@/constants/auth-theme';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { PlayTTColors } from '@/constants/playtt-tokens';
import { useAuthTheme } from '@/hooks/use-auth-theme';
import { useSession } from '@/lib/auth-client';

function parseAuthMode(mode: string | string[] | undefined): AuthMode {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value === 'sign-up' ? 'sign-up' : 'sign-in';
}

export default function AuthScreen() {
  const { data: session, isPending } = useSession();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const initialMode = parseAuthMode(modeParam);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const theme = useAuthTheme();

  if (isPending) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.pageBackground }]}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  const subtitle =
    mode === 'sign-in' ? 'Sign in to PlayTT' : 'Create your PlayTT account';

  return (
    <AuthShell subtitle={subtitle}>
      <AuthForm initialMode={initialMode} onModeChange={setMode} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
