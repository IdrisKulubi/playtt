import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      description="Use your PlayTT account to move back into booking, pricing, and future pod access without friction."
    >
      <SignInForm />
    </AuthShell>
  );
}
