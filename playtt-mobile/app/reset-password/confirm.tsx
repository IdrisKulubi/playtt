import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordConfirmForm } from '@/components/auth/reset-password-confirm-form';

export default function ResetPasswordConfirmScreen() {
  return (
    <AuthShell
      headline="Choose a new password."
      subtitle="Use at least eight characters. You can sign in right after saving."
    >
      <ResetPasswordConfirmForm />
    </AuthShell>
  );
}
