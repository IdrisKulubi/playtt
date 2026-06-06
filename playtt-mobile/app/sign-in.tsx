import { Redirect } from 'expo-router';

import { AuthShell } from '@/components/auth/auth-shell';
import { SignInForm } from '@/components/auth/sign-in-form';
import { useSession } from '@/lib/auth-client';

export default function SignInScreen() {
  const { data: session, isPending } = useSession();

  if (!isPending && session) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <AuthShell title="Sign in" description="Use your PlayTT email and password.">
      <SignInForm />
    </AuthShell>
  );
}
