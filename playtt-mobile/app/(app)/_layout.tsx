import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PlayTTColors } from '@/constants/playtt-tokens';
import { useSession } from '@/lib/auth-client';

export default function AppLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
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
