import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingCheckoutBar } from "@/components/booking/booking-checkout-bar"
import { BookingConfirmSheet } from "@/components/booking/booking-confirm-sheet"
import { BookingPaymentStep } from "@/components/booking/booking-payment-step"
import { BookingProgress } from "@/components/booking/booking-progress"
import { createBookingFlowStyles } from "@/components/booking/booking-theme"
import { VenueCard } from "@/components/booking/venue-card"
import { GroupSizeSheet } from "@/components/booking/group-size-sheet"
import { TimingPanel } from "@/components/booking/timing-panel"
import { Button } from "@/components/ui/button"
import { VenueCardSkeleton } from "@/components/ui/skeleton"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import { ApiError } from "@/lib/api-error"
import {
  createBooking,
  fetchAvailability,
  fetchBookingBootstrap,
  fetchBookingQuote,
} from "@/lib/booking-api"
import type {
  BookingQuote,
  BookingStep,
  CreateBookingResult,
  GroupSize,
  LocationSummary,
  SlotAvailability,
} from "@/lib/booking-types"
import {
  buildDateStrip,
  formatBookingStatus,
  formatKes,
  formatTimeRange,
  isSlotStartInPast,
  toDateKey,
} from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

export function BookingFlow() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createBookingFlowStyles(theme), [theme])
  const [step, setStep] = useState<BookingStep>("timing")
  const [locations, setLocations] = useState<LocationSummary[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(60)
  const [groupSize, setGroupSize] = useState<GroupSize>(2)
  const [slots, setSlots] = useState<SlotAvailability[]>([])
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null)
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [notes, setNotes] = useState("")
  const [confirmation, setConfirmation] = useState<CreateBookingResult | null>(null)
  const [groupSheetOpen, setGroupSheetOpen] = useState(false)
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false)
  const [groupConfirmed, setGroupConfirmed] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())

  const latestSelectedSlotRef = useRef<SlotAvailability | null>(null)
  const dateStrip = useMemo(() => buildDateStrip(7), [])
  const selectedLocation = locations.find((item) => item.id === selectedLocationId) ?? null
  const singleVenue = locations.length === 1
  const selectedResourceId =
    selectedSlot?.availableResourceIds[0] ??
    selectedLocation?.resources[0]?.id ??
    ""

  useEffect(() => {
    latestSelectedSlotRef.current = selectedSlot
  }, [selectedSlot])

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!selectedSlot) return
    if (!isSlotStartInPast(selectedSlot.startsAt, nowMs)) return
    setSelectedSlot(null)
    setQuote(null)
    setGroupConfirmed(false)
    setGroupSheetOpen(false)
    setConfirmSheetOpen(false)
  }, [nowMs, selectedSlot])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const data = await fetchBookingBootstrap()
        if (!mounted) return
        setLocations(data)
        if (data.length === 1) {
          setSelectedLocationId(data[0].id)
          setStep("timing")
        } else if (data[0]) {
          setSelectedLocationId(data[0].id)
          setStep("location")
        }
      } catch (error) {
        toast.apiError(error, "Could not load venues.")
      } finally {
        if (mounted) setIsBootstrapping(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const loadAvailability = useCallback(async () => {
    if (!selectedLocationId) return

    setIsLoadingSlots(true)
    try {
      const data = await fetchAvailability({
        locationId: selectedLocationId,
        date: selectedDate,
        durationMinutes,
        groupSize,
      })
      setSlots(data)

      const currentSlot = latestSelectedSlotRef.current
      if (!currentSlot) return

      const matchingSlot =
        data.find(
          (slot) => slot.startsAt === currentSlot.startsAt && slot.isAvailable,
        ) ?? null

      if (!matchingSlot) {
        setSelectedSlot(null)
        setQuote(null)
        setGroupConfirmed(false)
        setConfirmSheetOpen(false)
      } else {
        setSelectedSlot(matchingSlot)
      }
    } catch (error) {
      toast.apiError(error, "Could not load availability.")
    } finally {
      setIsLoadingSlots(false)
    }
  }, [durationMinutes, groupSize, selectedDate, selectedLocationId])

  useEffect(() => {
    if (step !== "timing" || !selectedLocationId) return
    void loadAvailability()
  }, [loadAvailability, selectedLocationId, step])

  const loadQuote = useCallback(async () => {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      return null
    }

    setIsLoadingQuote(true)
    try {
      const data = await fetchBookingQuote({
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
      })
      setQuote(data)
      return data
    } catch (error) {
      toast.apiError(error, "Could not calculate price.")
      setQuote(null)
      return null
    } finally {
      setIsLoadingQuote(false)
    }
  }, [
    durationMinutes,
    groupSize,
    selectedLocationId,
    selectedResourceId,
    selectedSlot,
  ])

  function handleDateChange(dateKey: string) {
    setSelectedDate(dateKey)
    setSelectedSlot(null)
    setQuote(null)
    setGroupConfirmed(false)
    setConfirmSheetOpen(false)
  }

  function handleDurationChange(value: 30 | 60) {
    setDurationMinutes(value)
    setSelectedSlot(null)
    setQuote(null)
    setGroupConfirmed(false)
    setConfirmSheetOpen(false)
  }

  function handleSlotSelect(slot: SlotAvailability) {
    setSelectedSlot(slot)
    setQuote(null)
    setGroupConfirmed(false)
    setConfirmSheetOpen(false)
    setGroupSheetOpen(true)
  }

  async function handleGroupContinue() {
    const nextQuote = await loadQuote()
    if (!nextQuote) return
    setGroupSheetOpen(false)
    setGroupConfirmed(true)
  }

  function handleOpenConfirm() {
    if (!selectedSlot || !groupConfirmed) return
    setConfirmSheetOpen(true)
  }

  async function handleConfirm() {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      toast.error("Select a time to continue.")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createBooking({
        locationId: selectedLocationId,
        resourceId: selectedResourceId,
        startTimeIso: selectedSlot.startsAt,
        durationMinutes,
        groupSize,
        notes: notes.trim() || undefined,
      })
      setConfirmation(result)
      setStep("pay")
      setConfirmSheetOpen(false)
      setGroupSheetOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === "SLOT_UNAVAILABLE") {
        toast.apiError(error, "That time was just taken. Pick another slot.")
        setSelectedSlot(null)
        setQuote(null)
        setGroupConfirmed(false)
        setConfirmSheetOpen(false)
        void loadAvailability()
        return
      }
      toast.apiError(error, "Could not complete your booking.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBookAnother() {
    setStep(singleVenue ? "timing" : "location")
    setConfirmation(null)
    setSelectedSlot(null)
    setQuote(null)
    setNotes("")
    setGroupConfirmed(false)
    setGroupSheetOpen(false)
    setConfirmSheetOpen(false)
  }

  const progressStep =
    step === "confirmed" || step === "pay"
      ? "done"
      : groupSheetOpen || groupConfirmed
        ? "players"
        : "when"

  const showCheckoutBar =
    step === "timing" &&
    Boolean(selectedSlot) &&
    groupConfirmed &&
    !groupSheetOpen &&
    !confirmSheetOpen

  if (isBootstrapping) {
    return (
      <View style={styles.loading}>
        <VenueCardSkeleton surface={skeletonSurface} />
      </View>
    )
  }

  if (locations.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No venues available</Text>
        <Text style={styles.emptyBody}>Check back soon for open booking slots.</Text>
      </View>
    )
  }

  const checkoutBarInset = showCheckoutBar ? 112 : 0

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      {step === "timing" ? (
        <View style={styles.timingPage}>
          <View style={styles.timingHeader}>
            <BookingProgress activeStep={progressStep} />
          </View>
          <TimingPanel
            location={selectedLocation}
            dateStrip={dateStrip}
            selectedDate={selectedDate}
            durationMinutes={durationMinutes}
            slots={slots}
            selectedSlot={selectedSlot}
            isLoadingSlots={isLoadingSlots}
            nowMs={nowMs}
            listBottomInset={checkoutBarInset}
            onDateChange={handleDateChange}
            onDurationChange={handleDurationChange}
            onSlotSelect={handleSlotSelect}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            showCheckoutBar && styles.scrollWithBar,
          ]}
        >
          {step !== "confirmed" && step !== "pay" ? (
            <BookingProgress activeStep={progressStep} />
          ) : null}

          {step === "location" ? (
            <View style={styles.section}>
              <Text style={styles.heading}>Choose a venue</Text>
              {locations.map((location) => (
                <VenueCard
                  key={location.id}
                  location={location}
                  selected={location.id === selectedLocationId}
                  onPress={() => {
                    setSelectedLocationId(location.id)
                    setSelectedSlot(null)
                    setQuote(null)
                    setGroupConfirmed(false)
                    setStep("timing")
                  }}
                />
              ))}
            </View>
          ) : null}

          {step === "pay" && confirmation && selectedSlot ? (
            <BookingPaymentStep
              confirmation={confirmation}
              location={selectedLocation}
              startTimeIso={selectedSlot.startsAt}
              endTimeIso={selectedSlot.endsAt}
              onConfirmed={() => {
                setConfirmation((current) =>
                  current
                    ? {
                        ...current,
                        status: "confirmed",
                        paymentStatus: "paid",
                      }
                    : current,
                )
                setStep("confirmed")
                toast.success("Payment received. You are booked!")
              }}
              onExpired={() => {
                toast.error("Your hold expired. Pick another slot.")
                handleBookAnother()
              }}
            />
          ) : null}

          {step === "confirmed" && confirmation ? (
            <View style={styles.section}>
              <Text style={styles.confirmedTitle}>You{"'"}re booked!</Text>
              <Text style={styles.confirmedBody}>
                {formatBookingStatus(confirmation.status, confirmation.paymentStatus)}
              </Text>
              {selectedSlot && selectedLocation ? (
                <>
                  <Text style={styles.confirmedVenue}>{selectedLocation.name}</Text>
                  <Text style={styles.confirmedMeta}>
                    {formatTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)}
                  </Text>
                  <Text style={styles.confirmedMeta}>
                    {formatKes(confirmation.totalAmount, confirmation.currency)}
                  </Text>
                </>
              ) : null}
              <Button
                label="View my bookings"
                surface="product"
                productTheme={theme}
                onPress={() => router.replace("/(app)/(tabs)/bookings")}
              />
              <Button
                label="Book another session"
                variant="outline"
                surface="product"
                productTheme={theme}
                onPress={handleBookAnother}
              />
            </View>
          ) : null}
        </ScrollView>
      )}

      <GroupSizeSheet
        visible={groupSheetOpen}
        groupSize={groupSize}
        currency={selectedSlot?.price.currency ?? "KES"}
        onClose={() => setGroupSheetOpen(false)}
        onGroupSizeChange={setGroupSize}
        onContinue={handleGroupContinue}
        loading={isLoadingQuote}
      />

      <BookingConfirmSheet
        visible={confirmSheetOpen}
        location={selectedLocation}
        selectedSlot={selectedSlot}
        groupSize={groupSize}
        quote={quote}
        notes={notes}
        loading={isSubmitting}
        onClose={() => setConfirmSheetOpen(false)}
        onNotesChange={setNotes}
        onConfirm={handleConfirm}
      />

      <BookingCheckoutBar
        visible={showCheckoutBar}
        selectedSlot={selectedSlot!}
        durationMinutes={durationMinutes}
        quote={quote}
        onPrimaryAction={handleOpenConfirm}
        disabled={isLoadingQuote || !quote}
      />
    </SafeAreaView>
  )
}
