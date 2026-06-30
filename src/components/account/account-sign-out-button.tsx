"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignOutIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function AccountSignOutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)

    const result = await authClient.signOut()

    if (result.error) {
      setIsSigningOut(false)
      toast.error(result.error.message || "Failed to sign out")
      return
    }

    toast.success("Signed out")
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isSigningOut}
      onClick={handleSignOut}
    >
      <SignOutIcon className="mr-2 size-4" />
      {isSigningOut ? "Signing out..." : "Sign out"}
    </Button>
  )
}
