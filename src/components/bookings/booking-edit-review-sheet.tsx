"use client"

import { formatMoney } from "@/components/bookings/booking-utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { UserBookingSummary } from "@/server/bookings/types"

type ModificationPreview = {
  currentTotal: string
  newTotal: string
  deltaAmount: string
  requiresPayment: boolean
  creditAmount: string
  newGroupSize: number
  newStartTime: string
  newEndTime: string
  currency: string
}

type BookingEditReviewSheetProps = {
  open: boolean
  booking: UserBookingSummary
  preview: ModificationPreview | null
  isQuoting: boolean
  isApplying: boolean
  onClose: () => void
  onConfirm: () => void
}

function formatSummaryLine(
  startTime: string,
  endTime: string,
  groupSize: number,
  total: string,
  currency: string,
) {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const time = (value: Date) =>
    value.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })

  return `${time(start)}–${time(end)} · ${groupSize} players · ${formatMoney(total, currency)}`
}

export function BookingEditReviewSheet({
  open,
  booking,
  preview,
  isQuoting,
  isApplying,
  onClose,
  onConfirm,
}: BookingEditReviewSheetProps) {
  const delta = preview ? Number(preview.deltaAmount) : 0
  const credit = preview ? Number(preview.creditAmount) : 0

  const ctaLabel = isApplying
    ? "Applying changes..."
    : preview && delta > 0
      ? `Pay ${formatMoney(preview.deltaAmount, preview.currency)} and confirm`
      : "Confirm changes"

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-[var(--radius-panel)] px-4 pb-5 sm:!top-1/2 sm:!bottom-auto sm:!left-1/2 sm:!right-auto sm:!max-h-[calc(100svh-3rem)] sm:!w-[min(28rem,calc(100vw-2rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:overflow-y-auto sm:rounded-[var(--radius-panel)]"
      >
        <SheetHeader className="px-0 pb-4 text-left">
          <SheetTitle className="text-lg font-semibold">Review changes</SheetTitle>
          <SheetDescription className="text-xs leading-5">
            {booking.locationName} · Same venue and time
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="rounded-[var(--radius-field)] border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatSummaryLine(
                booking.startTime,
                booking.endTime,
                booking.groupSize,
                booking.totalAmount,
                booking.currency,
              )}
            </p>
          </div>

          <div className="rounded-[var(--radius-field)] border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Updated
            </p>
            {isQuoting || !preview ? (
              <p className="mt-2 text-sm text-muted-foreground">Calculating...</p>
            ) : (
              <p className="mt-2 text-sm text-foreground">
                {formatSummaryLine(
                  preview.newStartTime,
                  preview.newEndTime,
                  preview.newGroupSize,
                  preview.newTotal,
                  preview.currency,
                )}
              </p>
            )}
          </div>

          {preview && credit > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              The lower total will be held as PlayTT account credit.
            </p>
          ) : null}

          {preview && delta > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              You will pay the difference securely via Paystack.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-2">
          <Button
            onClick={onConfirm}
            disabled={isQuoting || isApplying || !preview}
            className="w-full"
          >
            {ctaLabel}
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
