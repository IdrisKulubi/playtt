import { Redirect, useLocalSearchParams } from 'expo-router';

import { AuthShell } from '@/components/auth/auth-shell';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resolvedEmail = typeof email === 'string' ? email : '';

  if (!resolvedEmail) {
    return <Redirect href="/auth?mode=sign-up" />;
  }

  return (
    <AuthShell
      headline="Check your inbox."
      subtitle="Enter the code we sent to your email."
    >
      <VerifyEmailForm />
    </AuthShell>
  );
}
