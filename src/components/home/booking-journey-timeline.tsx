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
      className="journey-timeline flex flex-col gap-8 lg:grid lg:grid-cols-4 lg:gap-4"
    >
      {steps.map((step, index) => {
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id}
            className="journey-timeline__step relative flex gap-4 lg:flex lg:flex-col lg:items-center lg:gap-0 lg:text-center"
          >
            {!isLast ? (
              <span
                aria-hidden
                className="journey-timeline__connector journey-timeline__connector--vertical lg:hidden"
              />
            ) : null}
            {!isLast ? (
              <span
                aria-hidden
                className="journey-timeline__connector journey-timeline__connector--horizontal hidden lg:block"
              />
            ) : null}

            <div
              className={
                isFirst
                  ? "journey-timeline__node journey-timeline__node--active"
                  : "journey-timeline__node"
              }
            >
              <span className="sr-only">Step {step.id}:</span>
              {step.id}
            </div>

            <p className="min-w-0 pt-1 text-base font-medium leading-snug text-white lg:mt-4 lg:max-w-[9.5rem] lg:text-sm">
              {step.title}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
