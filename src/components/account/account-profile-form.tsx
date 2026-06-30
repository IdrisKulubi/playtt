"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, CircleNotchIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type AccountProfileFormProps = {
  initialName: string
  initialPhone: string
  initialSkillLevel: string
}

const skillOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "pro", label: "Pro" },
] as const

const fieldClassName =
  "h-11 w-full rounded-[var(--radius-field)] border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"

export function AccountProfileForm({
  initialName,
  initialPhone,
  initialSkillLevel,
}: AccountProfileFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [skillLevel, setSkillLevel] = useState(initialSkillLevel || "beginner")
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (name.trim().length < 2) {
      toast.error("Enter your full name.")
      return
    }

    if (!phone.trim()) {
      toast.error("Add a Kenyan phone number.")
      return
    }

    setIsSaving(true)

    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        phone,
        skillLevel,
      }),
    })

    const result = (await response.json().catch(() => null)) as {
      error?: { message?: string }
    } | null

    if (!response.ok) {
      toast.error(result?.error?.message || "Could not update your profile.")
      setIsSaving(false)
      return
    }

    toast.success("Profile updated.")
    router.refresh()
    router.push("/account")
  }

  return (
    <form onSubmit={handleSubmit} className="quiet-panel max-w-3xl p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="account-name">Full name</Label>
          <input
            id="account-name"
            className={fieldClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-phone">Phone number</Label>
          <input
            id="account-phone"
            className={fieldClassName}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="07XX XXX XXX"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-skill">Playing level</Label>
          <select
            id="account-skill"
            className={fieldClassName}
            value={skillLevel}
            onChange={(event) => setSkillLevel(event.target.value)}
          >
            {skillOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/account")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
          Save details
          {!isSaving ? <ArrowRightIcon className="size-4" /> : null}
        </Button>
      </div>
    </form>
  )
}
