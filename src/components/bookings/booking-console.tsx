"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { toast } from "sonner"

import {
  createPendingBookingAction,
  getAvailabilityAction,
  getBookingQuoteAction,
  planBookingAction,
} from "@/actions/booking-actions"
import { BookingCheckoutBar } from "@/components/bookings/booking-checkout-bar"
import { BookingSummaryRail } from "@/components/bookings/booking-summary-rail"
import {
  type BookingStep,
  type GroupSize,
  type SelectedSlot,
  isSlotStartInPast,
  slotFromSuggestion,
} from "@/components/bookings/booking-utils"
import { CheckoutSummary } from "@/components/bookings/checkout-summary"
import { CustomTimePanel } from "@/components/bookings/custom-time-panel"
import { GroupSizeSheet } from "@/components/bookings/group-size-sheet"
import { TimingPanel } from "@/components/bookings/timing-panel"
import { VenueList } from "@/components/bookings/venue-list"
import { authClient } from "@/lib/auth-client"
import {
  DEFAULT_VENUE_TIMEZONE,
  type BookingDurationMinutes,
} from "@/server/bookings/constants"
import { zonedWallTime } from "@/server/bookings/day-slots.mjs"
import type {
  BookingPlan,
  BookingQuote,
  BookingSuggestion,
  CreatePendingBookingResult,
  LocationSummary,
  SlotAvailability,
} from "@/server/bookings/types"
import type { InitiatePaymentResult } from "@/server/payments/types"

interface BookingConsoleProps {
  locations: LocationSummary[]
}

const stepLabels: Record<BookingStep, string> = {
  location: "Choose a venue",
  timing: "Pick a time",
  checkout: "Review booking",
}

export function BookingConsole({ locations }: BookingConsoleProps) {
  const { data: session } = authClient.useSession()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<BookingStep>(
    locations.length === 1 ? "timing" : "location"
  )
  const [selectedLocationId, setSelectedLocationId] = useState(
    locations[0]?.id ?? ""
  )
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  )
  const [durationMinutes, setDurationMinutes] =
    useState<BookingDurationMinutes>(60)
  const [groupSize, setGroupSize] = useState<GroupSize>(2)
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [plan, setPlan] = useState<BookingPlan | null>(null)
  const [isCheckingPlan, setIsCheckingPlan] = useState(false)
  const [availability, setAvailability] = useState<SlotAvailability[]>([])
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [notes, setNotes] = useState("")
  const [paymentDisplayText, setPaymentDisplayText] = useState<string | null>(
    null
  )
  const [isRedirectingToPayment, setIsRedirectingToPayment] = useState(false)
  const [showExtendedDates, setShowExtendedDates] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const latestSelectedSlotRef = useRef<SelectedSlot | null>(null)
  const customPanelRef = useRef<HTMLDivElement | null>(null)
  const lastAvailabilityKeyRef = useRef("")

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    latestSelectedSlotRef.current = selectedSlot
  }, [selectedSlot])

  useEffect(() => {
    if (!selectedSlot) return
    if (!isSlotStartInPast(selectedSlot.startsAt, nowMs)) return
    const t = window.setTimeout(() => {
      setSelectedSlot(null)
      setQuote(null)
    }, 0)
    return () => window.clearTimeout(t)
  }, [nowMs, selectedSlot])

  const selectedLocation = useMemo(
    () =>
      locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId]
  )

  const selectedResourceId = selectedSlot?.availableResourceIds[0] ?? ""

  const visibleSlots =
    selectedLocationId && selectedDate
      ? availability.filter((slot) => !isSlotStartInPast(slot.startsAt, nowMs))
      : []

  const isToday = selectedDate === format(new Date(nowMs), "yyyy-MM-dd")
  // Refresh today's list every minute so the "soonest" start keeps moving.
  const refreshMinute = isToday && step === "timing" ? Math.floor(nowMs / 60_000) : 0

  const venueTimeZone = selectedLocation?.timezone ?? DEFAULT_VENUE_TIMEZONE
  const firstOpenSlot = visibleSlots.find((slot) => slot.isAvailable)
  const customDefaultTime = firstOpenSlot
    ? format(new Date(firstOpenSlot.startsAt), "HH:mm")
    : "18:00"
  // Must sit on the 5-minute grid: the browser counts `step` from `min`.
  const customMinTime = isToday
    ? format(new Date(Math.ceil((nowMs - 60_000) / 300_000) * 300_000), "HH:mm")
    : undefined

  const dateStripDays = useMemo(() => {
    const start = startOfDay(new Date())
    const count = showExtendedDates ? 14 : 5
    return Array.from({ length: count }, (_, i) => addDays(start, i))
  }, [showExtendedDates])

  const selectedDay = useMemo(
    () => new Date(`${selectedDate}T12:00:00`),
    [selectedDate]
  )

  const quoteReady = Boolean(
    selectedSlot && selectedLocationId && selectedResourceId
  )
  const displayQuote = quoteReady ? quote : null

  const selectedSlotIsFuture =
    selectedSlot && !isSlotStartInPast(selectedSlot.startsAt, nowMs)

  const showMobileBar = step === "checkout" && Boolean(displayQuote)

  function handleLocationSelect(locationId: string) {
    setSelectedLocationId(locationId)
    setSelectedSlot(null)
    setQuote(null)
    setPlan(null)
    setStep("timing")
  }

  function handleDateChange(value: string) {
    setSelectedDate(value)
    setSelectedSlot(null)
    setQuote(null)
    setPlan(null)
  }

  function handleDurationChange(value: BookingDurationMinutes) {
    setDurationMinutes(value)
    setSelectedSlot(null)
    setQuote(null)
    setPlan(null)
  }

  function handleSlotSelect(slot: SelectedSlot) {
    setQuote(null)
    setPaymentDisplayText(null)
    setPlan(null)
    setSelectedSlot(slot)
    setGroupSheetOpen(true)
  }

  /** Checks any start time and shows either "free" or the nearest options. */
  async function checkStart(startTimeIso: string, minutes = durationMinutes) {
    if (!selectedLocationId) return
    setIsCheckingPlan(true)
    try {
      const result = await planBookingAction({
        locationId: selectedLocationId,
        startTimeIso,
        durationMinutes: minutes,
        groupSize,
      })
      if (!result.success) {
        toast.error(result.message)
        setPlan(null)
        return
      }
      setPlan(result.data)
      customPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    } finally {
      setIsCheckingPlan(false)
    }
  }

  function handleCustomCheck(time: string) {
    const [hour, minute] = time.split(":").map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return
    // Snap to the 5-minute step the venue books in.
    const snapped = Math.round(minute / 5) * 5
    const start = zonedWallTime(selectedDate, hour, 0, venueTimeZone)
    start.setTime(start.getTime() + snapped * 60_000)
    void checkStart(start.toISOString())
  }

  function handleTakenSlot(slot: SlotAvailability) {
    void checkStart(slot.startsAt)
  }

  function handleBookPlannedTime() {
    if (!plan || plan.status !== "available" || !plan.resourceId || !plan.price) {
      return
    }
    handleSlotSelect({
      startsAt: plan.requested.startsAt,
      endsAt: plan.requested.endsAt,
      durationMinutes: plan.requested.durationMinutes,
      isAvailable: true,
      openTableCount: 1,
      availableResourceIds: [plan.resourceId],
      price: plan.price,
      isCustom: true,
    })
  }

  function handlePickSuggestion(suggestion: BookingSuggestion) {
    // A shorter suggestion changes the game length too; keep the pick.
    if (suggestion.durationMinutes !== durationMinutes) {
      setDurationMinutes(suggestion.durationMinutes as BookingDurationMinutes)
    }
    handleSlotSelect(slotFromSuggestion(suggestion))
  }

  function handleGroupContinue() {
    setGroupSheetOpen(false)
    setStep("checkout")
  }

  useEffect(() => {
    if (!selectedLocationId || !selectedDate) {
      return
    }

    const availabilityKey = `${selectedLocationId}|${selectedDate}|${durationMinutes}|${groupSize}`
    const isRefresh = lastAvailabilityKeyRef.current === availabilityKey
    lastAvailabilityKeyRef.current = availabilityKey

    startTransition(async () => {
      if (!isRefresh) setAvailability([])
      const result = await getAvailabilityAction({
        locationId: selectedLocationId,
        date: selectedDate,
        durationMinutes,
        groupSize,
      })

      if (!result.success) {
        toast.error(result.message)
        setAvailability([])
        setSelectedSlot(null)
        setQuote(null)
        return
      }

      const data = result.data
      setAvailability(data)

      const currentSlot = latestSelectedSlotRef.current
      if (!currentSlot) {
        return
      }

      const listed = data.find((slot) => slot.startsAt === currentSlot.startsAt)
      const matchingSlot: SelectedSlot | null =
        listed?.isAvailable
          ? listed
          : // A custom time isn't in the list; the server re-checks it on booking.
            !listed &&
              currentSlot.isCustom &&
              currentSlot.durationMinutes === durationMinutes
            ? currentSlot
            : null

      if (!matchingSlot) {
        setQuote(null)
        setStep((s) => (s === "checkout" ? "timing" : s))
        setGroupSheetOpen(false)
      }

      setSelectedSlot(matchingSlot)
    })
  }, [durationMinutes, groupSize, selectedDate, selectedLocationId, refreshMinute])

  useEffect(() => {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      return
    }

    if (step !== "checkout") {
      return
    }

    startTransition(async () => {
      setQuote(null)
      setPaymentDisplayText(null)
      const result = await getBookingQuoteAction({
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
      })

      if (!result.success) {
        toast.error(result.message)
        setQuote(null)
        return
      }

      setQuote(result.data)
    })
  }, [
    durationMinutes,
    groupSize,
    selectedLocationId,
    selectedResourceId,
    selectedSlot,
    step,
  ])

  async function handleCreateBooking() {
    if (!session?.user?.id) {
      toast.error("Please sign in to complete your reservation.")
      return
    }

    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      toast.error("Select a venue and an available time to continue.")
      return
    }

    startTransition(async () => {
      setPaymentDisplayText(null)
      const result = await createPendingBookingAction({
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
        notes: notes.trim() || undefined,
      })

      if (!result.success) {
        toast.error(result.message)
        if (result.message.includes("no longer available")) {
          // Someone just took it: go back and offer the nearest free times.
          const taken = selectedSlot
          setSelectedSlot(null)
          setQuote(null)
          setStep("timing")
          void checkStart(taken.startsAt, taken.durationMinutes as BookingDurationMinutes)
        }
        return
      }

      await startPaystackCheckout(result.data)
    })
  }

  async function startPaystackCheckout(booking: CreatePendingBookingResult) {
    setIsRedirectingToPayment(true)

    try {
      const response = await fetch(`/api/bookings/${booking.bookingId}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client: "web" }),
      })

      const payload = (await response.json().catch(() => null)) as {
        data?: InitiatePaymentResult
        message?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not start payment.")
      }

      const payment = payload?.data

      if (!payment?.authorizationUrl) {
        throw new Error("Payment checkout URL was missing.")
      }

      setPaymentDisplayText(payment.displayText)
      toast.success("Opening secure checkout.")
      window.location.href = payment.authorizationUrl
      return
    } catch (error) {
      setIsRedirectingToPayment(false)
      toast.error(
        error instanceof Error ? error.message : "Could not start payment."
      )
      return
    }
  }

  const currency =
    selectedSlot?.price.currency ?? displayQuote?.currency ?? "KES"

  return (
    <div
      className={`booking-console space-y-6 ${showMobileBar ? "booking-console--with-mobile-action" : ""}`}
    >
      <div className="booking-console__grid">
        <div className="space-y-6">
          {step === "location" ? (
            <VenueList
              locations={locations}
              selectedLocationId={selectedLocationId}
              onSelect={handleLocationSelect}
            />
          ) : null}

          {step === "timing" ? (
            <TimingPanel
              location={selectedLocation}
              selectedDate={selectedDate}
              selectedDay={selectedDay}
              dateStripDays={dateStripDays}
              showExtendedDates={showExtendedDates}
              showDatePicker={showDatePicker}
              durationMinutes={durationMinutes}
              slots={visibleSlots}
              selectedSlot={selectedSlot}
              isPending={isPending}
              nowMs={nowMs}
              canChangeVenue={locations.length > 1}
              onBack={() => setStep("location")}
              onDateChange={handleDateChange}
              onShowExtendedDates={() => setShowExtendedDates(true)}
              onShowDatePicker={() => setShowDatePicker(true)}
              onDurationChange={handleDurationChange}
              onSlotSelect={handleSlotSelect}
              onTakenSlotSelect={handleTakenSlot}
              customTime={
                <div ref={customPanelRef}>
                  <CustomTimePanel
                    key={`${selectedDate}|${customDefaultTime}`}
                    defaultTime={customDefaultTime}
                    minTime={customMinTime}
                    durationMinutes={durationMinutes}
                    plan={plan}
                    isChecking={isCheckingPlan}
                    onCheck={handleCustomCheck}
                    onBookRequested={handleBookPlannedTime}
                    onPickSuggestion={handlePickSuggestion}
                  />
                </div>
              }
            />
          ) : null}

          {step === "checkout" ? (
            <CheckoutSummary
              location={selectedLocation}
              selectedSlot={selectedSlot}
              durationMinutes={durationMinutes}
              groupSize={groupSize}
              quote={displayQuote}
              notes={notes}
              userEmail={session?.user?.email}
              isPending={isPending || isRedirectingToPayment}
              canConfirm={Boolean(session?.user?.id)}
              paymentDisplayText={paymentDisplayText}
              confirmLabel={
                isRedirectingToPayment
                  ? "Opening Paystack..."
                  : isPending
                    ? "Preparing checkout..."
                    : "Pay with Paystack"
              }
              onBack={() => {
                setStep("timing")
                setGroupSheetOpen(true)
              }}
              onNotesChange={setNotes}
              onConfirm={handleCreateBooking}
            />
          ) : null}
        </div>

        <BookingSummaryRail
          location={selectedLocation}
          selectedSlot={selectedSlot}
          groupSize={groupSize}
          quote={displayQuote}
          stepLabel={stepLabels[step]}
        />
      </div>

      <GroupSizeSheet
        open={groupSheetOpen}
        groupSize={groupSize}
        currency={currency}
        onOpenChange={setGroupSheetOpen}
        onGroupSizeChange={setGroupSize}
        onContinue={handleGroupContinue}
      />

      <BookingCheckoutBar
        step="checkout"
        selectedSlot={selectedSlotIsFuture ? selectedSlot : null}
        durationMinutes={durationMinutes}
        quote={displayQuote}
        disabled={
          step === "checkout" &&
          (isPending || isRedirectingToPayment || !session?.user?.id)
        }
        onPrimaryAction={() => {
          handleCreateBooking()
        }}
        primaryLabel={isRedirectingToPayment ? "Opening..." : "Pay now"}
      />
    </div>
  )
}
