import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      description="Use your PlayTT account to access the booking app shell and verify that sessions are being created correctly."
    >
      <SignInForm />
    </AuthShell>
  );
}
