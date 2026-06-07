"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { toast } from "sonner"

import {
  createPendingBookingAction,
  getAvailabilityAction,
  getBookingQuoteAction,
} from "@/actions/booking-actions"
import { BookingCheckoutBar } from "@/components/bookings/booking-checkout-bar"
import { BookingSummaryRail } from "@/components/bookings/booking-summary-rail"
import {
  type BookingStep,
  type GroupSize,
  isSlotStartInPast,
} from "@/components/bookings/booking-utils"
import { CheckoutSummary } from "@/components/bookings/checkout-summary"
import { GroupSizeSheet } from "@/components/bookings/group-size-sheet"
import { TimingPanel } from "@/components/bookings/timing-panel"
import { VenueList } from "@/components/bookings/venue-list"
import { authClient } from "@/lib/auth-client"
import type {
  BookingQuote,
  LocationSummary,
  SlotAvailability,
} from "@/server/bookings/types"

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
  const [step, setStep] = useState<BookingStep>("location")
  const [selectedLocationId, setSelectedLocationId] = useState(
    locations[0]?.id ?? ""
  )
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  )
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(60)
  const [groupSize, setGroupSize] = useState<GroupSize>(2)
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(
    null
  )
  const [availability, setAvailability] = useState<SlotAvailability[]>([])
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [notes, setNotes] = useState("")
  const [showExtendedDates, setShowExtendedDates] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const latestSelectedSlotRef = useRef<SlotAvailability | null>(null)

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

  const visibleSlots = selectedLocationId && selectedDate ? availability : []

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

  const showMobileBar =
    (step === "timing" && selectedSlotIsFuture) ||
    (step === "checkout" && Boolean(displayQuote))

  function handleLocationSelect(locationId: string) {
    setSelectedLocationId(locationId)
    setSelectedSlot(null)
    setQuote(null)
    setStep("timing")
  }

  function handleDateChange(value: string) {
    setSelectedDate(value)
    setSelectedSlot(null)
    setQuote(null)
  }

  function handleDurationChange(value: 30 | 60) {
    setDurationMinutes(value)
    setSelectedSlot(null)
    setQuote(null)
  }

  function handleSlotSelect(slot: SlotAvailability) {
    setQuote(null)
    setSelectedSlot(slot)
    setGroupSheetOpen(true)
  }

  function handleGroupContinue() {
    setGroupSheetOpen(false)
    setStep("checkout")
  }

  useEffect(() => {
    if (!selectedLocationId || !selectedDate) {
      return
    }

    startTransition(async () => {
      setAvailability([])
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

      const matchingSlot =
        data.find(
          (slot) => slot.startsAt === currentSlot.startsAt && slot.isAvailable
        ) ?? null

      if (!matchingSlot) {
        setQuote(null)
        setStep((s) => (s === "checkout" ? "timing" : s))
        setGroupSheetOpen(false)
      }

      setSelectedSlot(matchingSlot)
    })
  }, [durationMinutes, groupSize, selectedDate, selectedLocationId])

  useEffect(() => {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      return
    }

    if (step !== "checkout") {
      return
    }

    startTransition(async () => {
      setQuote(null)
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
      const result = await createPendingBookingAction({
        userId: session.user.id,
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
        notes: notes.trim() || undefined,
      })

      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success("Reservation saved.")
      setNotes("")
      setSelectedSlot(null)
      setQuote(null)
      setStep("timing")
      setGroupSheetOpen(false)

      const refreshedAvailability = await getAvailabilityAction({
        locationId: selectedLocationId,
        date: selectedDate,
        durationMinutes,
        groupSize,
      })

      if (refreshedAvailability.success) {
        setAvailability(refreshedAvailability.data)
      }
    })
  }

  const currency =
    selectedSlot?.price.currency ?? displayQuote?.currency ?? "KES"

  return (
    <div className={`space-y-6 ${showMobileBar ? "pb-28 lg:pb-0" : ""}`}>
      <div className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
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
              onBack={() => setStep("location")}
              onDateChange={handleDateChange}
              onShowExtendedDates={() => setShowExtendedDates(true)}
              onShowDatePicker={() => setShowDatePicker(true)}
              onDurationChange={handleDurationChange}
              onSlotSelect={handleSlotSelect}
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
              isPending={isPending}
              canConfirm={Boolean(session?.user?.id)}
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
        step={step === "checkout" ? "checkout" : "timing"}
        selectedSlot={selectedSlotIsFuture ? selectedSlot : null}
        durationMinutes={durationMinutes}
        quote={displayQuote}
        disabled={step === "checkout" && (isPending || !session?.user?.id)}
        onPrimaryAction={() => {
          if (step === "timing") {
            setGroupSheetOpen(true)
            return
          }
          handleCreateBooking()
        }}
        primaryLabel={step === "checkout" ? "Confirm" : "Check out"}
      />
    </div>
  )
}
