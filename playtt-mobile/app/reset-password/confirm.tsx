import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordConfirmForm } from '@/components/auth/reset-password-confirm-form';

export default function ResetPasswordConfirmScreen() {
  return (
    <AuthShell
      headline="Choose a new password."
      subtitle="Enter the code from your email and choose a new password."
    >
      <ResetPasswordConfirmForm />
    </AuthShell>
  );
}
