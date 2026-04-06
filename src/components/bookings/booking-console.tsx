"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowRightIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  createPendingBookingAction,
  getAvailabilityAction,
  getBookingQuoteAction,
} from "@/actions/booking-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const selectedResourceId = selectedSlot?.availableResourceIds[0] ?? "";
  const extraPlayers = Math.max(0, groupSize - INCLUDED_PLAYERS);
  const playerSurcharge = extraPlayers * EXTRA_PLAYER_SURCHARGE;

  useEffect(() => {
    setSelectedSlot(null);
    setQuote(null);
    if (step !== "location") {
      setStep("timing");
    }
  }, [selectedLocationId, selectedDate, durationMinutes]);

  useEffect(() => {
    if (!selectedLocationId || !selectedDate) {
      setAvailability([]);
      return;
    }

    startTransition(async () => {
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

      setAvailability(result.data);
      setSelectedSlot((current) => {
        if (!current) {
          return null;
        }

        const matchingSlot =
          result.data.find(
            (slot) => slot.startsAt === current.startsAt && slot.isAvailable,
          ) ?? null;

        if (!matchingSlot) {
          setQuote(null);
          if (step === "group" || step === "checkout") {
            setStep("timing");
          }
        }

        return matchingSlot;
      });
    });
  }, [durationMinutes, groupSize, selectedDate, selectedLocationId, step]);

  useEffect(() => {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      setQuote(null);
      return;
    }

    startTransition(async () => {
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
      toast.error("Sign in before continuing to checkout.");
      return;
    }

    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      toast.error("Choose a location and time first.");
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

      toast.success("Booking reserved. Payment wiring is the next phase.");
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

  function handleSelectLocation(locationId: string) {
    setSelectedLocationId(locationId);
    setStep("timing");
  }

  function handleSelectSlot(slot: SlotAvailability) {
    if (!slot.isAvailable) {
      return;
    }

    setSelectedSlot(slot);
    setStep("group");
  }

  function renderStepPill(index: number, label: string, targetStep: BookingStep) {
    const active = step === targetStep;

    return (
      <button
        key={targetStep}
        type="button"
        onClick={() => {
          if (targetStep === "location") {
            setStep("location");
            return;
          }

          if (!selectedLocationId) {
            return;
          }

          if (targetStep === "group" && !selectedSlot) {
            return;
          }

          if (targetStep === "checkout" && !selectedSlot) {
            return;
          }

          setStep(targetStep);
        }}
        className={`rounded-full border px-4 py-2 text-sm transition ${
          active
            ? "border-primary/30 bg-primary/12 text-primary"
            : "border-white/10 bg-white/[0.04] text-white/55"
        }`}
      >
        {index}. {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {renderStepPill(1, "Place", "location")}
        {renderStepPill(2, "Timing", "timing")}
        {renderStepPill(3, "Players", "group")}
        {renderStepPill(4, "Checkout", "checkout")}
      </div>

      {step === "location" ? (
        <Card className="overflow-hidden border-white/10 bg-[#07111d]/95">
          <div className="bg-[linear-gradient(90deg,rgba(0,183,255,0.22),rgba(255,255,255,0.02))] px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">
              Step 1
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Choose where you want to play
            </h2>
          </div>
          <CardContent className="grid gap-4 p-6 lg:grid-cols-2">
            {locations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => handleSelectLocation(location.id)}
                className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 text-left transition hover:border-primary/40 hover:bg-primary/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold text-white">{location.name}</p>
                    <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
                      <MapPinIcon className="size-4 text-primary" />
                      <span>{location.address}</span>
                    </div>
                  </div>
                  <ArrowRightIcon className="mt-1 size-5 text-primary" />
                </div>

                <div className="mt-6 flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
                  <span className="text-sm text-white/70">Open pods / tables</span>
                  <span className="text-sm font-medium text-white">
                    {location.resources.length} available units
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {step === "timing" ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-white/10 bg-[#07111d]/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>{selectedLocation?.name ?? "Selected location"}</CardTitle>
                  <CardDescription>
                    Pick the day and session length, then choose an open table.
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setStep("location")}>
                  Change place
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.5rem] border border-primary/15 bg-primary/10 p-4 text-sm text-white/70">
                <div className="flex items-center gap-2 text-white">
                  <MapPinIcon className="size-4 text-primary" />
                  {selectedLocation?.address}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-white">Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="flex h-11 w-full rounded-full border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-white">Session</span>
                  <select
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(Number(event.target.value) as 30 | 60)
                    }
                    className="flex h-11 w-full rounded-full border border-white/10 bg-black/20 px-4 text-sm text-white outline-none"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </label>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/55">Current group baseline</p>
                <p className="mt-2 text-lg font-medium text-white">
                  {groupSize} players
                </p>
                <p className="mt-1 text-sm text-white/50">
                  You can adjust this after picking a time.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#07111d]/95">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Available timings</CardTitle>
                <CardDescription>
                  Each slot shows how many open tables are left at this location.
                </CardDescription>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                <CalendarDotsIcon className="mr-2 inline size-4" />
                {selectedDate}
              </div>
            </CardHeader>
            <CardContent>
              {availability.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-sm text-white/55">
                  {isPending
                    ? "Loading timings..."
                    : "No availability yet for this day. Try another date or duration."}
                </div>
              ) : (
                <div className="space-y-3">
                  {availability.map((slot) => {
                    const isSelected = selectedSlot?.startsAt === slot.startsAt;
                    const openTableLabel =
                      slot.openTableCount === 1
                        ? "1 open table"
                        : `${slot.openTableCount} open tables`;

                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        disabled={!slot.isAvailable || isPending}
                        className={`flex w-full items-center justify-between gap-4 rounded-[1.5rem] border px-5 py-4 text-left transition ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-black/20"
                        } ${!slot.isAvailable ? "opacity-40" : "hover:border-primary/35"}`}
                      >
                        <div>
                          <p className="text-base font-semibold text-white">
                            {format(new Date(slot.startsAt), "h:mm a")}
                          </p>
                          <p className="mt-2 text-sm text-white/58">{openTableLabel}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-medium text-white">
                            {slot.price.currency} {slot.price.totalAmount.toLocaleString()}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-primary">
                            {String(slot.price.pricingRuleSnapshot.pricingTier).replaceAll("_", " ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={() => setStep("group")}
                disabled={!selectedSlot}
                size="lg"
                className="mt-6 w-full"
              >
                Continue with this timing
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === "group" ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-white/10 bg-[#07111d]/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Choose your group size</CardTitle>
                  <CardDescription>
                    Up to {INCLUDED_PLAYERS} players are included. Larger groups add a surcharge.
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setStep("timing")}>
                  Back to timings
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {GROUP_SIZE_OPTIONS.map((size) => {
                const surcharge = Math.max(0, size - INCLUDED_PLAYERS) * EXTRA_PLAYER_SURCHARGE;
                const active = groupSize === size;

                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGroupSize(size)}
                    className={`flex w-full items-center justify-between rounded-[1.4rem] border px-5 py-4 text-left transition ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-white/10 bg-black/20 hover:border-primary/35"
                    }`}
                  >
                    <div>
                      <p className="text-base font-semibold text-white">
                        {size} players
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        {size <= INCLUDED_PLAYERS
                          ? "Included in the base booking."
                          : "Larger group surcharge applies."}
                      </p>
                    </div>
                    <div className="text-right text-sm font-medium text-white">
                      {surcharge > 0 ? `+ KES ${surcharge.toLocaleString()}` : "Included"}
                    </div>
                  </button>
                );
              })}

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Need a larger booking than 8 players? We can extend this into a group-booking flow next.
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#07111d]/95">
            <CardHeader>
              <CardTitle>Session snapshot</CardTitle>
              <CardDescription>
                Review the selected slot before moving to checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.5rem] border border-primary/15 bg-primary/10 p-5">
                <p className="text-sm text-white/55">{selectedLocation?.name}</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {selectedSlot
                    ? `${format(new Date(selectedSlot.startsAt), "EEE, d MMM")} at ${format(new Date(selectedSlot.startsAt), "h:mm a")}`
                    : "No time selected yet"}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  {selectedSlot
                    ? `${selectedSlot.openTableCount} tables open for this slot`
                    : "Choose a timing first"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                    Session length
                  </p>
                  <p className="mt-3 text-sm font-medium text-white">
                    {durationMinutes} minutes
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                    Group size
                  </p>
                  <p className="mt-3 text-sm font-medium text-white">
                    {groupSize} players
                  </p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/55">Added for larger groups</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  KES {playerSurcharge.toLocaleString()}
                </p>
              </div>

              <Button
                onClick={() => setStep("checkout")}
                disabled={!selectedSlot || !quote}
                size="lg"
                className="w-full"
              >
                Continue to checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === "checkout" ? (
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <Card className="border-white/10 bg-[#07111d]/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Checkout</CardTitle>
                  <CardDescription>
                    Review the booking summary before we create the pending reservation.
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setStep("group")}>
                  Back to players
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.75rem] border border-primary/15 bg-[linear-gradient(180deg,rgba(0,183,255,0.18),rgba(255,255,255,0.02))] p-5">
                <p className="text-sm text-white/55">{selectedLocation?.name}</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {selectedSlot
                    ? format(new Date(selectedSlot.startsAt), "h:mm a")
                    : "No time selected"}
                </p>
                <p className="mt-2 text-sm text-white/65">
                  {selectedSlot
                    ? `${format(new Date(selectedSlot.startsAt), "EEEE, d MMMM")} • ${durationMinutes} minutes`
                    : "Choose a valid slot to continue"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm text-white/55">
                    <ClockIcon className="size-4 text-primary" />
                    Timing
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">
                    {selectedSlot
                      ? `${format(new Date(selectedSlot.startsAt), "h:mm a")} - ${format(new Date(selectedSlot.endsAt), "h:mm a")}`
                      : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm text-white/55">
                    <CalendarDotsIcon className="size-4 text-primary" />
                    Players
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">
                    {groupSize} players
                  </p>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-white">Booking notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Access details, preferences, or anything the ops team should know."
                  className="min-h-28 w-full rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                {session?.user?.email ? (
                  <>
                    Reserving as <span className="font-medium text-white">{session.user.email}</span>
                  </>
                ) : (
                  "Sign in before creating the reservation so we can attach it to your account."
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#07111d]/95">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
              <CardDescription>
                Payment is the next phase, but the totals are already ready for checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote ? (
                <>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Session subtotal</span>
                    <span>
                      {quote.currency} {quote.subtotalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Group size surcharge</span>
                    <span>
                      {quote.currency} {quote.surchargeAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Discounts</span>
                    <span>
                      - {quote.currency} {quote.discountAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-[1.5rem] border border-primary/15 bg-primary/10 p-4 text-sm text-white/70">
                    <p>
                      {String(quote.pricingRuleSnapshot.pricingTier).replaceAll("_", " ")} pricing
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-primary">
                      Includes {INCLUDED_PLAYERS} players
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-base font-semibold text-white">Total</span>
                    <span className="text-2xl font-semibold text-white">
                      {quote.currency} {quote.totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <Button
                    onClick={handleCreateBooking}
                    disabled={isPending || !session?.user?.id}
                    size="lg"
                    className="w-full"
                  >
                    <CheckCircleIcon className="mr-2 size-4" />
                    Reserve booking
                  </Button>
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 p-6 text-sm text-white/55">
                  We are still calculating the booking summary for the selected slot.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
