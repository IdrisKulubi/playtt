import { format } from "date-fns";

import type { BookingQuote, LocationSummary, SlotAvailability } from "@/server/bookings/types";

interface BookingSummaryRailProps {
  location: LocationSummary | null;
  selectedSlot: SlotAvailability | null;
  groupSize: number;
  quote: BookingQuote | null;
  stepLabel: string;
}

export function BookingSummaryRail({
  location,
  selectedSlot,
  groupSize,
  quote,
  stepLabel,
}: BookingSummaryRailProps) {
  return (
    <aside className="hidden w-full max-w-xs space-y-3 xl:block xl:sticky xl:top-24 xl:self-start">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {stepLabel}
      </p>
      <div className="booking-summary">
        <p className="text-xs text-muted-foreground">Venue</p>
        <p className="font-medium text-foreground">{location?.name ?? "—"}</p>
        <p className="mt-3 text-xs text-muted-foreground">Time</p>
        <p className="font-medium text-foreground">
          {selectedSlot ? format(new Date(selectedSlot.startsAt), "EEE d MMM, h:mm a") : "—"}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Players</p>
        <p className="font-medium text-foreground">{groupSize}</p>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Total</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">
          {quote ? `${quote.currency} ${quote.totalAmount.toLocaleString()}` : "—"}
        </p>
      </div>
    </aside>
  );
}
