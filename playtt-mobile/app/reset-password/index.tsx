import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordScreen() {
  return (
    <AuthShell title="Forgot password" description="We will send a secure reset link to your inbox.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
