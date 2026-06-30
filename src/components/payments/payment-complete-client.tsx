"use client"

import Link from "next/link"
import { CheckCircleIcon } from "@phosphor-icons/react"
import { useCallback, useEffect } from "react"

import { BrandMark } from "@/components/layout/brand-mark"
import { Button } from "@/components/ui/button"
import { getPaymentCompleteDeepLink } from "@/lib/mobile-deep-link"

type PaymentCompleteClientProps = {
  bookingId?: string | null
  client?: "web" | "mobile"
  confirmed: boolean
}

export function PaymentCompleteClient({
  bookingId,
  client = "mobile",
  confirmed,
}: PaymentCompleteClientProps) {
  const isWeb = client === "web"

  const openApp = useCallback(() => {
    window.location.href = getPaymentCompleteDeepLink(bookingId)
  }, [bookingId])

  useEffect(() => {
    if (isWeb) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      openApp()
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [isWeb, openApp])

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-6 py-12 text-center text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <BrandMark
          href="/"
          tone="dark"
          size="compact"
          className="justify-center"
        />

        <div className="flex flex-col items-center gap-4">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-[#00ff66]/10 text-[#00ff66]">
            <CheckCircleIcon className="size-9" weight="fill" aria-hidden />
          </span>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              {confirmed ? "Payment confirmed" : "Payment received"}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {isWeb
                ? confirmed
                  ? "Your reservation is confirmed. You can return to your bookings."
                  : "We received the callback, but your booking still needs a status check."
                : confirmed
                  ? "Returning to PlayTT..."
                  : "Returning to PlayTT to check your booking..."}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          {isWeb ? (
            <>
              <Button asChild size="lg" className="w-full max-w-xs">
                <Link href="/bookings">View bookings</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full max-w-xs"
              >
                <Link href="/book">Book another session</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                className="w-full max-w-xs"
                onClick={openApp}
              >
                Open PlayTT
              </Button>
              <p className="text-xs text-muted-foreground">
                If you are not redirected automatically, tap Open PlayTT or
                close this window.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
