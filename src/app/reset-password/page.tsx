import { AuthShell } from "@/components/auth/auth-shell";
import { RequestPasswordResetForm } from "@/components/auth/request-password-reset-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Reset password" description="We will email you a secure link to choose a new password.">
      <RequestPasswordResetForm />
    </AuthShell>
  );
}
