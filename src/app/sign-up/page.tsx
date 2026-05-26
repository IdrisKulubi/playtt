import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell title="Create account" description="Set up your player account to book and manage sessions.">
      <SignUpForm />
    </AuthShell>
  );
}
