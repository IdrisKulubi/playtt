"use client";

import { format } from "date-fns";
import { ArrowRightIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import type { BookingQuote, SlotAvailability } from "@/server/bookings/types";

interface BookingCheckoutBarProps {
  step: "timing" | "checkout";
  selectedSlot: SlotAvailability | null;
  durationMinutes: number;
  quote: BookingQuote | null;
  onPrimaryAction: () => void;
  primaryLabel: string;
  disabled?: boolean;
}

export function BookingCheckoutBar({
  step,
  selectedSlot,
  durationMinutes,
  quote,
  onPrimaryAction,
  primaryLabel,
  disabled = false,
}: BookingCheckoutBarProps) {
  if (step === "timing" && !selectedSlot) {
    return null;
  }

  if (step === "checkout" && !quote) {
    return null;
  }

  return (
    <div className="booking-mobile-bar lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          {step === "timing" && selectedSlot ? (
            <>
              <p className="truncate text-xs opacity-70">
                {format(new Date(selectedSlot.startsAt), "EEE d MMM · h:mm a")}
              </p>
              <p className="truncate text-sm font-semibold">
                {durationMinutes} min · {selectedSlot.price.currency}{" "}
                {selectedSlot.price.totalAmount.toLocaleString()}
              </p>
            </>
          ) : null}
          {step === "checkout" && quote ? (
            <>
              <p className="text-xs opacity-70">Total</p>
              <p className="text-sm font-semibold tabular-nums">
                {quote.currency} {quote.totalAmount.toLocaleString()}
              </p>
            </>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          className="shrink-0 rounded-full border-0 bg-[var(--booking-bar-fg)] px-5 text-[var(--booking-bar-bg)] hover:bg-[var(--booking-bar-fg)]/90 disabled:opacity-50"
          onClick={onPrimaryAction}
        >
          {primaryLabel}
          <ArrowRightIcon className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
