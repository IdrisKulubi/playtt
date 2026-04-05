import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordConfirmForm } from "@/components/auth/reset-password-confirm-form";

export default function ResetPasswordConfirmPage() {
  return (
    <AuthShell
      eyebrow="New password"
      title="Set your new password"
      description="Use the secure token from your email to finish resetting your PlayTT password."
    >
      <Suspense fallback={null}>
        <ResetPasswordConfirmForm />
      </Suspense>
    </AuthShell>
  );
}
