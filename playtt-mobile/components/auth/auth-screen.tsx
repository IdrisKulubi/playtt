import { useState } from "react"

import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import type { AuthMode } from "@/constants/auth-theme"

/** The plain sign-in / sign-up form. No session checks, no redirects. */
export function AuthScreen({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode)

  return (
    <AuthShell
      headline={mode === "sign-in" ? "Welcome back." : "Your next game starts here."}
      subtitle={mode === "sign-in" ? "Sign in to PlayTT" : "Create your PlayTT account"}
    >
      <AuthForm initialMode={initialMode} onModeChange={setMode} />
    </AuthShell>
  )
}
