import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create account"
      title="Create your PlayTT identity"
      description="We’re setting up the first user journey now so booking, payment, and access later hang off a real authenticated player account."
    >
      <SignUpForm />
    </AuthShell>
  );
}
