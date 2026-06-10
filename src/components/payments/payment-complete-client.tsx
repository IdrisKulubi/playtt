"use client"

import { CheckCircleIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useState } from "react"

import { BrandMark } from "@/components/layout/brand-mark"
import { Button } from "@/components/ui/button"
import { getPaymentCompleteDeepLink } from "@/lib/mobile-deep-link"

const AUTO_REDIRECT_DELAY_MS = 700

type PaymentCompleteClientProps = {
  bookingId?: string | null
}

export function PaymentCompleteClient({ bookingId }: PaymentCompleteClientProps) {
  const [isRedirecting, setIsRedirecting] = useState(true)

  const openApp = useCallback(() => {
    window.location.href = getPaymentCompleteDeepLink(bookingId)
  }, [bookingId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      openApp()
      setIsRedirecting(false)
    }, AUTO_REDIRECT_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [openApp])

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-6 py-12 text-center text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <BrandMark href="/" tone="dark" size="compact" className="justify-center" />

        <div className="flex flex-col items-center gap-4">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-[#00ff66]/10 text-[#00ff66]">
            <CheckCircleIcon className="size-9" weight="fill" aria-hidden />
          </span>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              Payment received
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Return to PlayTT to see your booking.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <Button size="lg" className="w-full max-w-xs" onClick={openApp}>
            Open PlayTT
          </Button>

          {isRedirecting ? (
            <p className="text-xs text-muted-foreground">Opening app…</p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
