interface JourneyStep {
  id: string;
  title: string;
}

interface BookingJourneyTimelineProps {
  steps: readonly JourneyStep[];
}

export function BookingJourneyTimeline({ steps }: BookingJourneyTimelineProps) {
  return (
    <ol
      aria-label="Booking journey"
      className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-8 lg:gap-x-10"
    >
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2 text-sm">
          <span
            className={
              index === 0
                ? "font-semibold tabular-nums text-primary"
                : "font-medium tabular-nums text-muted-foreground"
            }
          >
            {step.id}
          </span>
          <span
            className={
              index === 0 ? "font-medium text-foreground" : "text-muted-foreground"
            }
          >
            {step.title}
          </span>
        </li>
      ))}
    </ol>
  );
}
