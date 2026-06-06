import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordConfirmForm } from '@/components/auth/reset-password-confirm-form';

export default function ResetPasswordConfirmScreen() {
  return (
    <AuthShell title="New password" description="Set a fresh password for your PlayTT account.">
      <ResetPasswordConfirmForm />
    </AuthShell>
  );
}
