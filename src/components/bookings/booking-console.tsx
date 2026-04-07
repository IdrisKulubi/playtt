"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  MapPinIcon,
  SparkleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  createPendingBookingAction,
  getAvailabilityAction,
  getBookingQuoteAction,
} from "@/actions/booking-actions";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { BookingQuote, LocationSummary, SlotAvailability } from "@/server/bookings/types";

const GROUP_SIZE_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;
const INCLUDED_PLAYERS = 5;
const EXTRA_PLAYER_SURCHARGE = 500;

type BookingStep = "location" | "timing" | "group" | "checkout";
type GroupSize = (typeof GROUP_SIZE_OPTIONS)[number];

interface BookingConsoleProps {
  locations: LocationSummary[];
}

const steps: Array<{ id: BookingStep; label: string; title: string }> = [
  { id: "location", label: "1", title: "Venue" },
  { id: "timing", label: "2", title: "Time" },
  { id: "group", label: "3", title: "Group" },
  { id: "checkout", label: "4", title: "Review" },
];

function formatPricingTierLabel(
  snapshot: Record<string, unknown> | undefined,
): string | null {
  if (!snapshot) return null;
  const tier = snapshot.pricingTier;
  if (typeof tier !== "string" || !tier.trim()) return null;
  return tier
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function availabilitySubtitle(slot: SlotAvailability): string {
  if (!slot.isAvailable || slot.openTableCount <= 0) return "Fully booked";
  if (slot.openTableCount === 1) return "1 table open";
  return `${slot.openTableCount} tables open`;
}

export function BookingConsole({ locations }: BookingConsoleProps) {
  const { data: session } = authClient.useSession();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<BookingStep>("location");
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(60);
  const [groupSize, setGroupSize] = useState<GroupSize>(2);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [notes, setNotes] = useState("");

  const latestSelectedSlotRef = useRef<SlotAvailability | null>(null);

  useEffect(() => {
    latestSelectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const selectedResourceId = selectedSlot?.availableResourceIds[0] ?? "";
  const extraPlayers = Math.max(0, groupSize - INCLUDED_PLAYERS);

  const visibleSlots =
    selectedLocationId && selectedDate ? availability : [];

  const quoteReady = Boolean(
    selectedSlot && selectedLocationId && selectedResourceId,
  );
  const displayQuote = quoteReady ? quote : null;

  function handleLocationSelect(locationId: string) {
    setSelectedLocationId(locationId);
    setSelectedSlot(null);
    setQuote(null);
    setStep("timing");
  }

  function handleDateChange(value: string) {
    setSelectedDate(value);
    setSelectedSlot(null);
    setQuote(null);
    setStep((prev) => (prev !== "location" ? "timing" : prev));
  }

  function handleDurationChange(value: 30 | 60) {
    setDurationMinutes(value);
    setSelectedSlot(null);
    setQuote(null);
    setStep((prev) => (prev !== "location" ? "timing" : prev));
  }

  useEffect(() => {
    if (!selectedLocationId || !selectedDate) {
      return;
    }

    startTransition(async () => {
      setAvailability([]);
      const result = await getAvailabilityAction({
        locationId: selectedLocationId,
        date: selectedDate,
        durationMinutes,
        groupSize,
      });

      if (!result.success) {
        toast.error(result.message);
        setAvailability([]);
        setSelectedSlot(null);
        setQuote(null);
        return;
      }

      const data = result.data;
      setAvailability(data);

      const currentSlot = latestSelectedSlotRef.current;
      if (!currentSlot) {
        return;
      }

      const matchingSlot =
        data.find(
          (slot) =>
            slot.startsAt === currentSlot.startsAt && slot.isAvailable,
        ) ?? null;

      if (!matchingSlot) {
        setQuote(null);
        setStep((s) => (s === "group" || s === "checkout" ? "timing" : s));
      }

      setSelectedSlot(matchingSlot);
    });
  }, [durationMinutes, groupSize, selectedDate, selectedLocationId, step]);

  useEffect(() => {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      return;
    }

    startTransition(async () => {
      setQuote(null);
      const result = await getBookingQuoteAction({
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
      });

      if (!result.success) {
        toast.error(result.message);
        setQuote(null);
        return;
      }

      setQuote(result.data);
    });
  }, [durationMinutes, groupSize, selectedLocationId, selectedResourceId, selectedSlot]);

  async function handleCreateBooking() {
    if (!session?.user?.id) {
      toast.error("Please sign in to complete your reservation.");
      return;
    }

    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      toast.error("Select a venue and an available time to continue.");
      return;
    }

    startTransition(async () => {
      const result = await createPendingBookingAction({
        userId: session.user.id,
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Reservation saved.");
      setNotes("");
      setSelectedSlot(null);
      setQuote(null);
      setStep("timing");

      const refreshedAvailability = await getAvailabilityAction({
        locationId: selectedLocationId,
        date: selectedDate,
        durationMinutes,
        groupSize,
      });

      if (refreshedAvailability.success) {
        setAvailability(refreshedAvailability.data);
      }
    });
  }

  function goToStep(nextStep: BookingStep) {
    if (nextStep === "location") {
      setStep("location");
      return;
    }

    if (!selectedLocationId) {
      return;
    }

    if ((nextStep === "group" || nextStep === "checkout") && !selectedSlot) {
      return;
    }

    setStep(nextStep);
  }

  function renderStepNavigation() {
    return (
      <nav aria-label="Booking steps" className="glass-panel px-3 py-3 sm:px-5 sm:py-4">
        <ol className="flex flex-wrap items-center gap-1 sm:gap-0">
          {steps.map((item, index) => {
            const currentIndex = steps.findIndex((entry) => entry.id === step);
            const itemIndex = steps.findIndex((entry) => entry.id === item.id);
            const isActive = item.id === step;
            const isPast = currentIndex > itemIndex;

            return (
              <li key={item.id} className="flex items-center">
                {index > 0 ? (
                  <div
                    className={`mx-1.5 hidden h-px w-5 sm:block md:w-8 ${
                      isPast ? "bg-primary/30" : "bg-white/[0.08]"
                    }`}
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => goToStep(item.id)}
                  className={`flex items-center gap-2 rounded-full px-2.5 py-2 transition sm:gap-2.5 sm:px-3 ${
                    isActive
                      ? "bg-primary/[0.12] text-white ring-1 ring-primary/30"
                      : isPast
                        ? "text-white/75 hover:bg-white/[0.04]"
                        : "text-white/38 hover:bg-white/[0.03] hover:text-white/55"
                  }`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(0,183,255,0.35)]"
                        : isPast
                          ? "border border-primary/35 bg-primary/10 text-primary"
                          : "border border-white/12 bg-white/[0.04] text-white/45"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-sm font-medium">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  function renderLocationStep() {
    return (
      <section className="glass-panel-strong p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Venue</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white">
              Where would you like to play?
            </h2>
            <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-white/55">
              Select a club to see live availability for that location only.
            </p>
          </div>
          <p className="shrink-0 text-sm text-white/45">
            {locations.length} {locations.length === 1 ? "location" : "locations"}
          </p>
        </div>

        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          {locations.map((location) => {
            const active = location.id === selectedLocationId;
            const tableCount = location.resources.length;

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => handleLocationSelect(location.id)}
                className={`group premium-card overflow-hidden p-0 text-left transition ${
                  active
                    ? "border-primary/35 ring-1 ring-primary/25"
                    : "hover:border-white/18 hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
                }`}
              >
                <div className="relative aspect-[21/9] w-full overflow-hidden bg-gradient-to-br from-primary/20 via-white/[0.06] to-transparent sm:aspect-[2.4/1]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,183,255,0.25),transparent_50%)]" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        active
                          ? "bg-primary/90 text-primary-foreground"
                          : "border border-white/15 bg-black/30 text-white/80 backdrop-blur-sm"
                      }`}
                    >
                      {tableCount} {tableCount === 1 ? "table" : "tables"}
                    </span>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {location.name}
                      </p>
                      <div className="mt-2 flex items-start gap-2 text-sm text-white/50">
                        <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary/90" />
                        <span className="leading-snug">{location.address}</span>
                      </div>
                    </div>
                    <ArrowRightIcon
                      className={`mt-1 size-5 shrink-0 transition group-hover:translate-x-0.5 ${
                        active ? "text-primary" : "text-white/35 group-hover:text-primary/80"
                      }`}
                    />
                  </div>
                  <p className="mt-4 text-xs text-white/40">Tap to view available times</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderTimingStep() {
    return (
      <section className="glass-panel-strong p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Schedule</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white">
              Choose your time
            </h2>
            <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-white/55">
              Times update in real time. Unavailable blocks are shown so you are never guessing.
            </p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 self-start rounded-full sm:self-auto"
            onClick={() => setStep("location")}
          >
            <ArrowLeftIcon className="mr-2 size-4" />
            Change venue
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-8">
          <div className="space-y-4">
            <div className="premium-card border-white/[0.07] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                Your club
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{selectedLocation?.name}</p>
              <div className="mt-2 flex items-start gap-2 text-sm text-white/50">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary/85" />
                <span>{selectedLocation?.address}</span>
              </div>
            </div>

            <div className="premium-card border-white/[0.07] p-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/90">Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none ring-primary/30 focus:ring-2"
                />
              </label>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-white/90">Length</span>
                <select
                  value={durationMinutes}
                  onChange={(event) =>
                    handleDurationChange(Number(event.target.value) as 30 | 60)
                  }
                  className="flex h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none ring-primary/30 focus:ring-2"
                >
                  <option value={30}>Half hour</option>
                  <option value={60}>One hour</option>
                </select>
              </label>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                  Available times
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {format(new Date(`${selectedDate}T12:00:00`), "EEEE, MMMM d")}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <CalendarDotsIcon className="size-3.5" />
                {durationMinutes} min session
              </div>
            </div>

            <ul className="flex max-h-[min(28rem,55vh)] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[min(32rem,60vh)]">
              {visibleSlots.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-10 text-center text-sm text-white/50">
                  {isPending
                    ? "Checking availability…"
                    : "Nothing open for this day yet. Try another date or session length."}
                </li>
              ) : (
                visibleSlots.map((slot) => {
                  const selected = selectedSlot?.startsAt === slot.startsAt;
                  const tier = formatPricingTierLabel(slot.price.pricingRuleSnapshot);

                  return (
                    <li key={slot.startsAt}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!slot.isAvailable) {
                            return;
                          }

                          setQuote(null);
                          setSelectedSlot(slot);
                        }}
                        disabled={!slot.isAvailable || isPending}
                        className={`booking-slot-row ${selected ? "booking-slot-row--selected" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold tabular-nums text-white sm:text-lg">
                              {format(new Date(slot.startsAt), "h:mm a")}
                            </span>
                            {tier ? (
                              <span className="booking-tier-badge">{tier}</span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-white/45 sm:text-sm">
                            until {format(new Date(slot.endsAt), "h:mm a")}
                          </p>
                        </div>

                        <div className="hidden w-28 shrink-0 text-center sm:block">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/35">
                            Status
                          </p>
                          <p
                            className={`mt-1 text-xs font-medium ${
                              slot.isAvailable ? "text-emerald-300/90" : "text-white/40"
                            }`}
                          >
                            {availabilitySubtitle(slot)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums text-white">
                              {slot.price.currency} {slot.price.totalAmount.toLocaleString()}
                            </p>
                            <p className="mt-0.5 text-[10px] text-white/40 sm:hidden">
                              {availabilitySubtitle(slot)}
                            </p>
                          </div>
                          <div className="flex size-9 items-center justify-center text-primary">
                            {selected ? (
                              <CheckCircleIcon className="size-7" weight="fill" />
                            ) : (
                              <CircleIcon className="size-6 text-white/25" />
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {selectedSlot ? (
              <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/50">
                  <span className="font-medium text-white/80">
                    {format(new Date(selectedSlot.startsAt), "h:mm a")}
                  </span>
                  {" · "}
                  {selectedSlot.price.currency} {selectedSlot.price.totalAmount.toLocaleString()}
                </p>
                <Button
                  className="w-full rounded-full sm:w-auto"
                  onClick={() => setStep("group")}
                >
                  Continue to party size
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function renderGroupStep() {
    return (
      <section className="glass-panel-strong p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Party size</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white">
              How many people are playing?
            </h2>
            <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-white/55">
              Your session price includes up to {INCLUDED_PLAYERS} players. Need more? The add-on is
              shown before you pay.
            </p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 self-start rounded-full sm:self-auto"
            onClick={() => setStep("timing")}
          >
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to times
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_minmax(0,20rem)] lg:gap-8">
          <div className="flex flex-col gap-2">
            {GROUP_SIZE_OPTIONS.map((size) => {
              const active = size === groupSize;
              const surcharge = Math.max(0, size - INCLUDED_PLAYERS) * EXTRA_PLAYER_SURCHARGE;

              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setGroupSize(size)}
                  className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition sm:px-5 sm:py-4 ${
                    active
                      ? "border-primary/40 bg-primary/[0.1] shadow-[0_0_0_1px_rgba(0,183,255,0.15)]"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                        active
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-white/10 bg-black/25 text-white/50"
                      }`}
                    >
                      <UsersThreeIcon className="size-5" weight={active ? "fill" : "regular"} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{size} players</p>
                      <p className="mt-0.5 text-xs text-white/45 sm:text-sm">
                        {size <= INCLUDED_PLAYERS
                          ? "Covered in your base rate"
                          : "Includes larger-group add-on"}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
                      Add-on
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                      {surcharge > 0
                        ? `+ ${selectedSlot?.price.currency ?? "KES"} ${surcharge.toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4 lg:pt-1">
            <div className="premium-card border-white/[0.07] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                Your slot
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {selectedSlot
                  ? `${format(new Date(selectedSlot.startsAt), "EEE, MMM d")} · ${format(new Date(selectedSlot.startsAt), "h:mm a")}`
                  : "Select a time"}
              </p>
              <p className="mt-2 text-sm text-white/45">
                {selectedSlot ? availabilitySubtitle(selectedSlot) : "Go back to choose a start time."}
              </p>
            </div>

            <div className="premium-card border-white/[0.07] p-5">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                Group add-on (est.)
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {selectedSlot?.price.currency ?? "KES"}{" "}
                {(extraPlayers * EXTRA_PLAYER_SURCHARGE).toLocaleString()}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/45 sm:text-sm">
                {extraPlayers > 0
                  ? `For ${extraPlayers} extra guest${extraPlayers > 1 ? "s" : ""} above ${INCLUDED_PLAYERS}.`
                  : `No add-on until you go above ${INCLUDED_PLAYERS} players.`}
              </p>
            </div>

            <Button
              onClick={() => setStep("checkout")}
              disabled={!selectedSlot || !displayQuote}
              size="lg"
              className="hidden w-full rounded-full shadow-[0_12px_40px_rgba(0,183,255,0.2)] lg:flex"
            >
              Review &amp; reserve
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    );
  }

  function renderCheckoutStep() {
    const tierLabel = displayQuote
      ? formatPricingTierLabel(displayQuote.pricingRuleSnapshot)
      : null;

    return (
      <section className="glass-panel-strong p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Review</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-white">
              Almost there
            </h2>
            <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-white/55">
              Double-check your session details and total. You can add a short note for the front desk if
              you need to.
            </p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 self-start rounded-full sm:self-auto"
            onClick={() => setStep("group")}
          >
            <ArrowLeftIcon className="mr-2 size-4" />
            Edit party size
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)] lg:gap-8">
          <div className="premium-card border-white/[0.07] p-6 sm:p-7">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-transparent p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                {selectedLocation?.name}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {selectedSlot ? format(new Date(selectedSlot.startsAt), "h:mm a") : "—"}
              </p>
              <p className="mt-2 text-sm text-white/55">
                {selectedSlot
                  ? `${format(new Date(selectedSlot.startsAt), "EEEE, MMMM d")} · ${durationMinutes} minutes`
                  : "Choose a time to continue"}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-white/40">
                  <ClockIcon className="size-4 text-primary/90" />
                  Session
                </div>
                <p className="mt-2 text-sm font-medium text-white">
                  {selectedSlot
                    ? `${format(new Date(selectedSlot.startsAt), "h:mm a")} – ${format(new Date(selectedSlot.endsAt), "h:mm a")}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-white/40">
                  <UsersThreeIcon className="size-4 text-primary/90" />
                  Party
                </div>
                <p className="mt-2 text-sm font-medium text-white">{groupSize} players</p>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-white/90">Notes for the venue (optional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. birthday, equipment needs, arrival time"
                className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none ring-primary/25 placeholder:text-white/30 focus:ring-2"
              />
            </label>

            <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55">
              {session?.user?.email ? (
                <>
                  Signed in as{" "}
                  <span className="font-medium text-white/90">{session.user.email}</span>
                </>
              ) : (
                "Sign in to attach this reservation to your account."
              )}
            </div>
          </div>

          <div className="premium-card flex flex-col border-white/[0.07] p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <SparkleIcon className="size-5" weight="fill" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">
                  Summary
                </p>
                <p className="mt-1 text-xl font-semibold text-white">Your total</p>
              </div>
            </div>

            {displayQuote ? (
              <>
                <div className="mt-6 space-y-3 border-b border-white/[0.06] pb-5">
                  <div className="flex items-center justify-between text-sm text-white/65">
                    <span>Session</span>
                    <span className="tabular-nums">
                      {displayQuote.currency} {displayQuote.subtotalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/65">
                    <span>Group add-on</span>
                    <span className="tabular-nums">
                      {displayQuote.currency} {displayQuote.surchargeAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/65">
                    <span>Discounts</span>
                    <span className="tabular-nums text-emerald-300/90">
                      −{displayQuote.currency} {displayQuote.discountAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {tierLabel ? (
                  <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-100/85">
                    <span className="booking-tier-badge mr-2 border-sky-400/30">{tierLabel}</span>
                    rate applies to this session.
                  </div>
                ) : null}

                <p className="mt-4 text-xs text-white/40">
                  Base rate includes up to {INCLUDED_PLAYERS} players.
                </p>

                <div className="mt-6 flex items-end justify-between border-t border-white/[0.06] pt-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/40">Total</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
                      {displayQuote.currency} {displayQuote.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleCreateBooking}
                  disabled={isPending || !session?.user?.id}
                  size="lg"
                  className="mt-6 w-full rounded-full bg-primary text-primary-foreground shadow-[0_16px_48px_rgba(0,183,255,0.25)] hover:bg-primary/92"
                >
                  <CheckCircleIcon className="mr-2 size-4" />
                  Confirm reservation
                </Button>
              </>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/50">
                Updating your quote…
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const showMobileActionBar =
    (step === "timing" && selectedSlot) || (step === "group" && displayQuote);

  return (
    <div className={`space-y-6 ${showMobileActionBar ? "pb-28 lg:pb-0" : ""}`}>
      {renderStepNavigation()}

      <div className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
        <div className="space-y-6">
          {step === "location" && renderLocationStep()}
          {step === "timing" && renderTimingStep()}
          {step === "group" && renderGroupStep()}
          {step === "checkout" && renderCheckoutStep()}
        </div>

        <aside className="hidden space-y-4 xl:block xl:sticky xl:top-24 xl:self-start">
          <div className="glass-panel border-white/[0.06] p-5">
            <p className="section-label">Your booking</p>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                  Venue
                </p>
                <p className="mt-1.5 text-sm font-medium text-white">
                  {selectedLocation?.name ?? "Not selected"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                  Time
                </p>
                <p className="mt-1.5 text-sm font-medium text-white">
                  {selectedSlot
                    ? format(new Date(selectedSlot.startsAt), "EEE d MMM · h:mm a")
                    : "Not selected"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                  Party
                </p>
                <p className="mt-1.5 text-sm font-medium text-white">{groupSize} players</p>
              </div>
            </div>
          </div>

          <div className="glass-panel border-white/[0.06] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
              Estimated total
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {displayQuote
                ? `${displayQuote.currency} ${displayQuote.totalAmount.toLocaleString()}`
                : "—"}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-white/45">
              Updates when you change time, length, or party size. Taxes and payment are finalized at
              checkout.
            </p>
          </div>
        </aside>
      </div>

      {showMobileActionBar ? (
        <div className="booking-mobile-bar lg:hidden">
          {step === "timing" && selectedSlot ? (
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-white/45">
                  {format(new Date(selectedSlot.startsAt), "EEE d MMM · h:mm a")}
                </p>
                <p className="truncate text-sm font-semibold text-white">
                  {selectedSlot.price.currency} {selectedSlot.price.totalAmount.toLocaleString()} ·{" "}
                  {durationMinutes} min
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 rounded-full px-5"
                onClick={() => setStep("group")}
              >
                Next
                <ArrowRightIcon className="ml-1 size-4" />
              </Button>
            </div>
          ) : null}
          {step === "group" && displayQuote ? (
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white/45">Estimated total</p>
                <p className="text-sm font-semibold tabular-nums text-white">
                  {displayQuote.currency} {displayQuote.totalAmount.toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 rounded-full px-5"
                onClick={() => setStep("checkout")}
              >
                Review
                <ArrowRightIcon className="ml-1 size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
