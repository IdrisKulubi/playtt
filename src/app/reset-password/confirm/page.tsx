import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordConfirmForm } from "@/components/auth/reset-password-confirm-form";

export default function ResetPasswordConfirmPage() {
  return (
    <AuthShell title="New password" description="Enter the code from your email and choose a new password.">
      <Suspense fallback={null}>
        <ResetPasswordConfirmForm />
      </Suspense>
    </AuthShell>
  );
}
