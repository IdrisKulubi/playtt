import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordScreen() {
  return (
    <AuthShell
      headline="Reset your password."
      subtitle="We will email a 6-digit code to continue."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
