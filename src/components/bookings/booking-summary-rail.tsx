import { format } from "date-fns";

import type {
  BookingQuote,
  LocationSummary,
  SlotAvailability,
} from "@/server/bookings/types";

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
  const activeStep =
    stepLabel === "Review booking" ? 3 : stepLabel === "Pick a time" ? 1 : 0;

  return (
    <aside className="booking-summary-rail">
      <div className="booking-summary-rail__progress" aria-label="Booking progress">
        {["Time", "Players", "Review"].map((label, index) => (
          <span
            key={label}
            className={
              index <= activeStep
                ? "booking-progress__item booking-progress__item--active"
                : "booking-progress__item"
            }
          >
            <b>{index + 1}</b>
            {label}
          </span>
        ))}
      </div>

      <div className="booking-summary">
        <p className="booking-summary__eyebrow">Your session</p>
        <dl>
          <div>
            <dt>Venue</dt>
            <dd>{location?.name ?? "Not selected"}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              {selectedSlot
                ? format(new Date(selectedSlot.startsAt), "EEE d MMM, h:mm a")
                : "Choose a time"}
            </dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd>{groupSize} players</dd>
          </div>
        </dl>

        <div className="booking-summary__total">
          <span>Total</span>
          <strong>
            {quote
              ? `${quote.currency} ${quote.totalAmount.toLocaleString()}`
              : "Calculated next"}
          </strong>
        </div>
      </div>
    </aside>
  );
}
