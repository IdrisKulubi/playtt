"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addDays, format, isSameDay, isToday, startOfDay } from "date-fns";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CircleIcon,
  MapPinIcon,
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
  if (!slot.isAvailable || slot.openTableCount <= 0) return "No tables";
  if (slot.openTableCount === 1) return "1 open table";
  return `${slot.openTableCount} open tables`;
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

  const visibleSlots =
    selectedLocationId && selectedDate ? availability : [];

  const dateStripDays = useMemo(() => {
    const start = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, []);

  const selectedDay = useMemo(
    () => new Date(`${selectedDate}T12:00:00`),
    [selectedDate],
  );

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
      <nav
        aria-label="Steps"
        className="flex max-w-lg flex-wrap justify-center gap-1 sm:max-w-none sm:justify-start"
      >
        {steps.map((item) => {
          const currentIndex = steps.findIndex((entry) => entry.id === step);
          const itemIndex = steps.findIndex((entry) => entry.id === item.id);
          const isActive = item.id === step;
          const isPast = currentIndex > itemIndex;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToStep(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "bg-primary/20 text-primary"
                  : isPast
                    ? "text-white/55 hover:text-white/80"
                    : "text-white/30 hover:text-white/50"
              }`}
            >
              {item.title}
            </button>
          );
        })}
      </nav>
    );
  }

  function renderLocationStep() {
    return (
      <section className="mx-auto w-full max-w-lg glass-panel-strong overflow-hidden p-0 sm:max-w-xl">
        <ul className="divide-y divide-white/[0.08]">
          {locations.map((location) => {
            const active = location.id === selectedLocationId;
            const tableCount = location.resources.length;

            return (
              <li key={location.id}>
                <button
                  type="button"
                  onClick={() => handleLocationSelect(location.id)}
                  className={`flex w-full items-center gap-3 px-4 py-4 text-left transition sm:gap-4 sm:px-5 sm:py-4 ${
                    active ? "bg-primary/[0.08]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary/30 to-white/[0.04] sm:size-16">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_30%,rgba(0,183,255,0.35),transparent_65%)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{location.name}</p>
                    <div className="mt-0.5 flex items-start gap-1.5 text-sm text-white/45">
                      <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-pink-400/90" weight="fill" />
                      <span className="leading-snug">{location.address}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tableCount > 1 ? (
                        <span className="rounded bg-primary/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                          Multi table
                        </span>
                      ) : (
                        <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                          1 table
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRightIcon className="size-4 shrink-0 text-white/25" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  function renderTimingStep() {
    return (
      <section className="mx-auto w-full max-w-lg glass-panel-strong p-4 sm:max-w-xl sm:p-5">
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-white/70"
            onClick={() => setStep("location")}
            aria-label="Back"
          >
            <ArrowLeftIcon className="size-5" />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-white">
            {selectedLocation?.name}
          </h2>
          <span className="size-9 shrink-0" aria-hidden />
        </div>

        <div className="-mx-1 mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-0 px-1">
            {dateStripDays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const sel = isSameDay(d, selectedDay);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDateChange(key)}
                  className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                    sel
                      ? "border-white text-white"
                      : "border-transparent text-white/40 hover:text-white/65"
                  }`}
                >
                  {isToday(d) ? "Today" : format(d, "EEE, M/d")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex gap-0 rounded-xl bg-primary/30 p-1 ring-1 ring-primary/25">
          <button
            type="button"
            onClick={() => handleDurationChange(30)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              durationMinutes === 30
                ? "bg-white text-[#07111d] shadow-sm"
                : "text-white/85 hover:text-white"
            }`}
          >
            30 min
          </button>
          <button
            type="button"
            onClick={() => handleDurationChange(60)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              durationMinutes === 60
                ? "bg-white text-[#07111d] shadow-sm"
                : "text-white/85 hover:text-white"
            }`}
          >
            60 min
          </button>
        </div>

        <label className="sr-only" htmlFor="booking-date-fallback">
          Pick a date
        </label>
        <input
          id="booking-date-fallback"
          type="date"
          value={selectedDate}
          onChange={(event) => handleDateChange(event.target.value)}
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60"
        />

        <ul className="mt-4 max-h-[min(26rem,52vh)] divide-y divide-white/[0.08] overflow-y-auto rounded-xl border border-white/[0.08] sm:max-h-[min(30rem,58vh)]">
          {visibleSlots.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-white/45">
              {isPending ? "Loading…" : "No times this day."}
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
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:gap-4 ${
                      selected ? "bg-primary/[0.12]" : ""
                    } ${!slot.isAvailable ? "opacity-45" : "hover:bg-white/[0.03]"}`}
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="text-base font-semibold tabular-nums text-white">
                        {format(new Date(slot.startsAt), "h:mm a")}
                      </span>
                      {tier ? (
                        <span className="booking-tier-badge">{tier.toUpperCase()}</span>
                      ) : null}
                    </div>
                    <p
                      className={`hidden w-24 shrink-0 text-center text-xs font-medium sm:block ${
                        slot.isAvailable ? "text-white/55" : "text-white/35"
                      }`}
                    >
                      {availabilitySubtitle(slot)}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-white sm:min-w-[4.5rem] sm:text-right">
                      {slot.price.currency} {slot.price.totalAmount.toLocaleString()}
                    </p>
                    <div className="flex size-8 shrink-0 items-center justify-center text-primary">
                      {selected ? (
                        <CheckCircleIcon className="size-6" weight="fill" />
                      ) : (
                        <CircleIcon className="size-5 text-white/20" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selectedSlot ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <p className="min-w-0 truncate text-sm tabular-nums text-white/60">
              {format(new Date(selectedSlot.startsAt), "h:mm a")} ·{" "}
              {selectedSlot.price.currency} {selectedSlot.price.totalAmount.toLocaleString()}
            </p>
            <Button size="sm" className="shrink-0 rounded-full px-5" onClick={() => setStep("group")}>
              Next
              <ArrowRightIcon className="ml-1 size-4" />
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  function renderGroupStep() {
    return (
      <section className="mx-auto w-full max-w-lg glass-panel-strong p-4 sm:max-w-xl sm:p-5">
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-white/70"
            onClick={() => setStep("timing")}
            aria-label="Back"
          >
            <ArrowLeftIcon className="size-5" />
          </Button>
          <h2 className="flex-1 text-center text-base font-semibold text-white">Players</h2>
          <span className="size-9 shrink-0" aria-hidden />
        </div>

        <ul className="mt-4 divide-y divide-white/[0.08] rounded-xl border border-white/[0.08]">
          {GROUP_SIZE_OPTIONS.map((size) => {
            const active = size === groupSize;
            const surcharge = Math.max(0, size - INCLUDED_PLAYERS) * EXTRA_PLAYER_SURCHARGE;

            return (
              <li key={size}>
                <button
                  type="button"
                  onClick={() => setGroupSize(size)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
                    active ? "bg-primary/[0.1]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UsersThreeIcon
                      className={`size-5 ${active ? "text-primary" : "text-white/35"}`}
                      weight={active ? "fill" : "regular"}
                    />
                    <span className="font-medium text-white">{size} players</span>
                  </div>
                  <span className="text-sm tabular-nums text-white/45">
                    {surcharge > 0
                      ? `+${selectedSlot?.price.currency ?? "KES"} ${surcharge.toLocaleString()}`
                      : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-center text-xs text-white/35">
          Base includes {INCLUDED_PLAYERS} players.
        </p>

        <Button
          onClick={() => setStep("checkout")}
          disabled={!selectedSlot || !displayQuote}
          className="mt-5 hidden w-full rounded-full lg:flex"
          size="lg"
        >
          Review
          <ArrowRightIcon className="ml-2 size-4" />
        </Button>
      </section>
    );
  }

  function renderCheckoutStep() {
    const tierLabel = displayQuote
      ? formatPricingTierLabel(displayQuote.pricingRuleSnapshot)
      : null;

    return (
      <section className="mx-auto w-full max-w-lg glass-panel-strong p-4 sm:max-w-xl sm:p-5">
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-white/70"
            onClick={() => setStep("group")}
            aria-label="Back"
          >
            <ArrowLeftIcon className="size-5" />
          </Button>
          <h2 className="flex-1 text-center text-base font-semibold text-white">Summary</h2>
          <span className="size-9 shrink-0" aria-hidden />
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs text-white/40">{selectedLocation?.name}</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {selectedSlot ? format(new Date(selectedSlot.startsAt), "h:mm a") : "—"}
          </p>
          <p className="mt-1 text-sm text-white/45">
            {selectedSlot
              ? `${format(new Date(selectedSlot.startsAt), "EEE MMM d")} · ${durationMinutes}m · ${groupSize} players`
              : ""}
          </p>
          {tierLabel ? (
            <span className="booking-tier-badge mt-3 inline-block">{tierLabel.toUpperCase()}</span>
          ) : null}
        </div>

        {displayQuote ? (
          <ul className="mt-4 space-y-2 border-b border-white/[0.08] pb-4 text-sm">
            <li className="flex justify-between text-white/60">
              <span>Session</span>
              <span className="tabular-nums text-white">
                {displayQuote.currency} {displayQuote.subtotalAmount.toLocaleString()}
              </span>
            </li>
            <li className="flex justify-between text-white/60">
              <span>Add-on</span>
              <span className="tabular-nums text-white">
                {displayQuote.currency} {displayQuote.surchargeAmount.toLocaleString()}
              </span>
            </li>
            <li className="flex justify-between text-white/60">
              <span>Discount</span>
              <span className="tabular-nums text-emerald-300/90">
                −{displayQuote.currency} {displayQuote.discountAmount.toLocaleString()}
              </span>
            </li>
          </ul>
        ) : (
          <p className="mt-4 text-center text-sm text-white/40">Loading</p>
        )}

        {displayQuote ? (
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm font-medium text-white/50">Total</span>
            <span className="text-2xl font-semibold tabular-nums text-white">
              {displayQuote.currency} {displayQuote.totalAmount.toLocaleString()}
            </span>
          </div>
        ) : null}

        <label className="mt-5 block">
          <span className="text-xs text-white/45">Note</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
            className="mt-1 min-h-16 w-full resize-y rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25"
          />
        </label>

        <p className="mt-3 text-xs text-white/35">
          {session?.user?.email ? session.user.email : "Sign in to reserve."}
        </p>

        {displayQuote ? (
          <Button
            onClick={handleCreateBooking}
            disabled={isPending || !session?.user?.id}
            size="lg"
            className="mt-5 w-full rounded-full"
          >
            <CheckCircleIcon className="mr-2 size-4" />
            Confirm
          </Button>
        ) : null}
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

        <aside className="hidden w-full max-w-xs space-y-3 xl:block xl:sticky xl:top-24 xl:self-start">
          <div className="glass-panel border-white/[0.06] p-4 text-sm">
            <p className="text-xs text-white/35">Venue</p>
            <p className="font-medium text-white">{selectedLocation?.name ?? "—"}</p>
            <p className="mt-3 text-xs text-white/35">Time</p>
            <p className="font-medium text-white">
              {selectedSlot ? format(new Date(selectedSlot.startsAt), "EEE d MMM, h:mm a") : "—"}
            </p>
            <p className="mt-3 text-xs text-white/35">Players</p>
            <p className="font-medium text-white">{groupSize}</p>
            <p className="mt-4 border-t border-white/[0.08] pt-3 text-xs text-white/35">Total</p>
            <p className="text-lg font-semibold tabular-nums text-white">
              {displayQuote
                ? `${displayQuote.currency} ${displayQuote.totalAmount.toLocaleString()}`
                : "—"}
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
