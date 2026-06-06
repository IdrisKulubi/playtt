import { Redirect, useLocalSearchParams } from 'expo-router';

import { AuthShell } from '@/components/auth/auth-shell';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resolvedEmail = typeof email === 'string' ? email : '';

  if (!resolvedEmail) {
    return <Redirect href="/sign-up" />;
  }

  return (
    <AuthShell title="Verify email" description="Confirm your inbox before entering PlayTT.">
      <VerifyEmailForm />
    </AuthShell>
  );
}
