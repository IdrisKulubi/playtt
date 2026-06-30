"use client"

import { format } from "date-fns"
import {
  ArrowLeftIcon,
  CreditCardIcon,
  LockKeyIcon,
} from "@phosphor-icons/react"

import { formatPricingTierLabel } from "@/components/bookings/booking-utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type {
  BookingQuote,
  LocationSummary,
  SlotAvailability,
} from "@/server/bookings/types"

interface CheckoutSummaryProps {
  location: LocationSummary | null
  selectedSlot: SlotAvailability | null
  durationMinutes: 30 | 60
  groupSize: number
  quote: BookingQuote | null
  notes: string
  userEmail?: string | null
  isPending: boolean
  canConfirm: boolean
  paymentDisplayText?: string | null
  confirmLabel?: string
  onBack: () => void
  onNotesChange: (value: string) => void
  onConfirm: () => void
}

export function CheckoutSummary({
  location,
  selectedSlot,
  durationMinutes,
  groupSize,
  quote,
  notes,
  userEmail,
  isPending,
  canConfirm,
  paymentDisplayText,
  confirmLabel = "Pay with Paystack",
  onBack,
  onNotesChange,
  onConfirm,
}: CheckoutSummaryProps) {
  const tierLabel = quote
    ? formatPricingTierLabel(quote.pricingRuleSnapshot)
    : null
  const endTime =
    selectedSlot &&
    new Date(
      new Date(selectedSlot.startsAt).getTime() + durationMinutes * 60_000
    )

  return (
    <section className="booking-stage mx-auto w-full max-w-lg sm:max-w-xl">
      <div className="product-shell-header flex items-center gap-2 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeftIcon className="size-5" />
        </Button>
        <h2 className="flex-1 text-center text-base font-semibold text-foreground">
          Order summary
        </h2>
        <span className="size-9 shrink-0" aria-hidden />
      </div>

      <div className="space-y-4 px-4 py-5">
        <div>
          <p className="text-xs text-muted-foreground">
            {location?.name ?? "—"} · Private pod
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {selectedSlot
              ? format(new Date(selectedSlot.startsAt), "h:mm a")
              : "—"}
            {endTime ? ` – ${format(endTime, "h:mm a")}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedSlot
              ? format(new Date(selectedSlot.startsAt), "EEE, MMM d")
              : ""}{" "}
            · {durationMinutes} min
          </p>
          {tierLabel ? (
            <span className="booking-tier-badge mt-3 inline-block">
              {tierLabel}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-field)] border border-border px-3 py-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Table
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              Auto selection
            </p>
          </div>
          <div className="rounded-[var(--radius-field)] border border-border px-3 py-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Group size
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {groupSize} players
            </p>
          </div>
        </div>

        {quote ? (
          <ul className="space-y-2 border-y border-border py-4 text-sm">
            <li className="flex justify-between text-muted-foreground">
              <span>Session</span>
              <span className="text-foreground tabular-nums">
                {quote.currency} {quote.subtotalAmount.toLocaleString()}
              </span>
            </li>
            <li className="flex justify-between text-muted-foreground">
              <span>Add-on</span>
              <span className="text-foreground tabular-nums">
                {quote.currency} {quote.surchargeAmount.toLocaleString()}
              </span>
            </li>
            {quote.discountAmount > 0 ? (
              <li className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="text-emerald-600 tabular-nums">
                  −{quote.currency} {quote.discountAmount.toLocaleString()}
                </span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Loading quote…
          </p>
        )}

        {quote ? (
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Total
            </span>
            <span className="text-2xl font-semibold text-foreground tabular-nums">
              {quote.currency} {quote.totalAmount.toLocaleString()}
            </span>
          </div>
        ) : null}

        <div className="rounded-[var(--radius-field)] border border-primary/20 bg-primary/8 px-3 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <LockKeyIcon className="size-4" weight="fill" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Secure Paystack checkout
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Your slot is held first, then Paystack opens to complete
                payment.
              </p>
              {paymentDisplayText ? (
                <p className="mt-2 text-xs font-medium text-primary">
                  {paymentDisplayText}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-xs text-muted-foreground">Note (optional)</span>
          <Textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Anything the team should know?"
            className="surface-inset mt-1 min-h-20 text-sm"
          />
        </label>

        <p className="text-xs text-muted-foreground">
          {userEmail ? userEmail : "Sign in to confirm your reservation."}
        </p>

        {quote ? (
          <Button
            onClick={onConfirm}
            disabled={isPending || !canConfirm}
            size="lg"
            className="hidden w-full rounded-full lg:flex"
          >
            <CreditCardIcon className="mr-2 size-4" />
            {confirmLabel}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
