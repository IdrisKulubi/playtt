import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title="Create your PlayTT identity"
      description="Set up the player account that booking, payment, and future pod access will all attach to."
    >
      <SignUpForm />
    </AuthShell>
  );
}
