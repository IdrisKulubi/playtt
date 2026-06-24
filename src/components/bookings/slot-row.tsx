import { format } from "date-fns"
import { CheckCircleIcon, CircleIcon } from "@phosphor-icons/react"

import {
  availabilitySubtitle,
  formatPricingTierLabel,
  isSlotStartInPast,
} from "@/components/bookings/booking-utils"
import type { SlotAvailability } from "@/server/bookings/types"

interface SlotRowProps {
  slot: SlotAvailability
  selected: boolean
  disabled: boolean
  nowMs: number
  onSelect: () => void
}

export function SlotRow({
  slot,
  selected,
  disabled,
  nowMs,
  onSelect,
}: SlotRowProps) {
  const startInPast = isSlotStartInPast(slot.startsAt, nowMs)
  const tier = formatPricingTierLabel(slot.price.pricingRuleSnapshot)

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (!disabled) onSelect()
        }}
        disabled={disabled}
        className={`booking-slot-row ${selected && !startInPast ? "booking-slot-row--selected" : ""}`}
      >
        <span className="min-w-[4.5rem] text-base font-semibold text-foreground tabular-nums">
          {format(new Date(slot.startsAt), "h:mm a")}
        </span>
        <span
          className={`hidden flex-1 text-center text-xs font-medium sm:block ${
            slot.isAvailable && !startInPast
              ? "text-muted-foreground"
              : "text-muted-foreground/60"
          }`}
        >
          {availabilitySubtitle(slot, startInPast)}
        </span>
        {tier ? (
          <span className="booking-tier-badge hidden sm:inline-flex">
            {tier}
          </span>
        ) : (
          <span className="hidden flex-1 sm:block" aria-hidden />
        )}
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {slot.price.currency} {slot.price.totalAmount.toLocaleString()}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center text-primary sm:ml-auto">
          {selected && !startInPast ? (
            <CheckCircleIcon className="size-6" weight="fill" />
          ) : (
            <CircleIcon className="size-5 text-border" />
          )}
        </span>
      </button>
      <p className="px-4 pb-2 text-[10px] text-muted-foreground sm:hidden">
        {availabilitySubtitle(slot, startInPast)}
      </p>
    </li>
  )
}
