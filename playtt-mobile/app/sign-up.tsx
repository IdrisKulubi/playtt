import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { PlayTTColors } from '@/constants/playtt-tokens';
import { useSession } from '@/lib/auth-client';

export default function SignUpScreen() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <AuthShell
      title="Create account"
      description="Join PlayTT with email and password or continue with Google.">
      <SignUpForm />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PlayTTColors.background,
  },
});
