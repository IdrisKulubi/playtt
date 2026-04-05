import { AuthShell } from "@/components/auth/auth-shell";
import { RequestPasswordResetForm } from "@/components/auth/request-password-reset-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Reset password"
      title="Recover your account"
      description="Enter your email to receive a secure reset link and get back into PlayTT."
    >
      <RequestPasswordResetForm />
    </AuthShell>
  );
}
