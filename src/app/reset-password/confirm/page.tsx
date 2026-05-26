import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordConfirmForm } from "@/components/auth/reset-password-confirm-form";

export default function ResetPasswordConfirmPage() {
  return (
    <AuthShell title="New password" description="Choose a new password for your account.">
      <Suspense fallback={null}>
        <ResetPasswordConfirmForm />
      </Suspense>
    </AuthShell>
  );
}
