"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { CircleNotchIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const fieldClassName =
  "h-11 w-full rounded-[var(--radius-field)] border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"

export function AccountChangePasswordForm() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters for the new password.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("The new passwords do not match.")
      return
    }

    setIsSaving(true)

    const result = (await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    })) as { error?: { message?: string } | null }

    if (result.error) {
      toast.error(result.error.message || "Could not update your password.")
      setIsSaving(false)
      return
    }

    toast.success("Password updated.")
    router.refresh()
    router.push("/account")
  }

  return (
    <form onSubmit={handleSubmit} className="quiet-panel max-w-2xl p-5 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <input
            id="current-password"
            className={fieldClassName}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Enter current password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <input
            id="new-password"
            className={fieldClassName}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <input
            id="confirm-password"
            className={fieldClassName}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter new password"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/account")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
          Update password
        </Button>
      </div>
    </form>
  )
}
