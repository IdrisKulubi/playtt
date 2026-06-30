"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CircleNotchIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { sendVerificationEmailAction } from "@/actions/auth-actions"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

type AccountVerifyEmailPanelProps = {
  email: string
}

export function AccountVerifyEmailPanel({ email }: AccountVerifyEmailPanelProps) {
  const router = useRouter()
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function verify(nextOtp = otp) {
    if (nextOtp.length !== 6) {
      toast.error("Enter the 6 digit code.")
      return
    }

    setIsLoading(true)

    const { error } = await authClient.emailOtp.verifyEmail({
      email,
      otp: nextOtp,
    })

    if (error) {
      toast.error(error.message || "Invalid verification code.")
      setIsLoading(false)
      return
    }

    toast.success("Email verified.")
    router.refresh()
    router.push("/account")
  }

  async function resend() {
    setIsLoading(true)
    const result = await sendVerificationEmailAction(email)

    if (!result.success) {
      toast.error(result.message)
      setIsLoading(false)
      return
    }

    toast.info("Verification code sent.")
    setIsLoading(false)
  }

  return (
    <section className="quiet-panel max-w-2xl p-5 sm:p-6">
      <p className="text-sm leading-7 text-muted-foreground">
        Enter the six digit code sent to{" "}
        <span className="font-semibold text-foreground">{email}</span>.
      </p>

      <div className="mt-6 flex justify-center">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={(value) => {
            setOtp(value)
            if (value.length === 6) {
              void verify(value)
            }
          }}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={resend} disabled={isLoading}>
          Resend code
        </Button>
        <Button type="button" onClick={() => void verify()} disabled={isLoading}>
          {isLoading ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
          Verify email
        </Button>
      </div>
    </section>
  )
}
