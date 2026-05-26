import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell title="Sign in" description="Use your PlayTT email and password.">
      <SignInForm />
    </AuthShell>
  );
}
