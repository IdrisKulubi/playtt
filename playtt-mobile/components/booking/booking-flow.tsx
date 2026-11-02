import { type Href, router } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BackHandler, StyleSheet, TextInput, View } from "react-native"

import { BookingSummary } from "@/components/booking/flow/booking-summary"
import { ChoiceChips } from "@/components/booking/flow/choice-chips"
import { DateStrip } from "@/components/booking/flow/date-strip"
import { PayStep } from "@/components/booking/flow/pay-step"
import { PlayerStepper } from "@/components/booking/flow/player-stepper"
import { TimeGrid } from "@/components/booking/flow/time-grid"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { EmptyState } from "@/components/kit/empty-state"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Screen } from "@/components/kit/screen"
import { StepHeader } from "@/components/kit/step-header"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { VenueCardSkeleton } from "@/components/ui/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { ApiError } from "@/lib/api-error"
import {
  createBooking,
  fetchAvailability,
  fetchBookingBootstrap,
  fetchBookingQuote,
} from "@/lib/booking-api"
import type {
  BookingQuote,
  CreateBookingResult,
  GroupSize,
  LocationSummary,
  SlotAvailability,
} from "@/lib/booking-types"
import {
  addDaysToDateKey,
  buildDateStrip,
  EXTRA_PLAYER_SURCHARGE,
  extraPlayerSurcharge,
  formatKes,
  INCLUDED_PLAYERS,
  isSlotStartInPast,
  toDateKey,
} from "@/lib/booking-utils"
import { haptics } from "@/lib/haptics"
import { toast } from "@/lib/toast"

type FlowStep = "venue" | "time" | "players" | "review" | "pay" | "done"

const STEP_TITLES: Record<FlowStep, string> = {
  venue: "Where do you want to play?",
  time: "When do you want to play?",
  players: "How many players?",
  review: "Check and book",
  pay: "Pay to confirm",
  done: "You're booked!",
}

/** What the back button says when it returns to that step. */
const STEP_BACK_LABELS: Partial<Record<FlowStep, string>> = {
  venue: "Place",
  time: "Time",
  players: "Players",
}

const DURATION_OPTIONS = [
  { value: 60 as const, label: "1 hour" },
  { value: 30 as const, label: "30 min" },
]

const BOOKINGS_HREF = "/(app)/(tabs)/bookings" as Href
const PLAY_HREF = "/(app)/(tabs)" as Href

/**
 * Booking flow (redesign Phase 2): one step per screen state, "Step N of 3"
 * at the top, a sticky price bar at the bottom, and a back button that keeps
 * everything already chosen.
 */
export function BookingFlow() {
  const { colors } = useAppTheme()
  const skeletonSurface = useSkeletonSurface()
  const [step, setStep] = useState<FlowStep>("time")
  const [locations, setLocations] = useState<LocationSummary[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(60)
  const [groupSize, setGroupSize] = useState<GroupSize>(2)
  const [slots, setSlots] = useState<SlotAvailability[]>([])
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null)
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [confirmation, setConfirmation] = useState<CreateBookingResult | null>(null)
  const [notes, setNotes] = useState("")
  const [nowMs, setNowMs] = useState(() => Date.now())

  // Times are loading whenever what's on screen was fetched for other choices.
  const availabilityKey = `${selectedLocationId}|${selectedDate}|${durationMinutes}|${groupSize}`
  const [loadedAvailabilityKey, setLoadedAvailabilityKey] = useState<string | null>(null)
  const isLoadingSlots = loadedAvailabilityKey !== availabilityKey

  const latestSelectedSlotRef = useRef<SlotAvailability | null>(null)
  const dateStrip = useMemo(() => buildDateStrip(7), [])
  const selectedLocation = locations.find((item) => item.id === selectedLocationId) ?? null
  const singleVenue = locations.length <= 1
  const selectedResourceId =
    selectedSlot?.availableResourceIds[0] ?? selectedLocation?.resources[0]?.id ?? ""

  const flowSteps: FlowStep[] = singleVenue
    ? ["time", "players", "review"]
    : ["venue", "time", "players", "review"]
  const stepIndex = flowSteps.indexOf(step)

  useEffect(() => {
    latestSelectedSlotRef.current = selectedSlot
  }, [selectedSlot])

  const clearSelection = useCallback(() => {
    setSelectedSlot(null)
    setQuote(null)
  }, [])

  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Each tick also checks the chosen time: once it has started, people pick again.
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now()
      setNowMs(now)
      const slot = latestSelectedSlotRef.current
      if (!slot || !isSlotStartInPast(slot.startsAt, now)) return
      clearSelection()
      if (stepRef.current === "players" || stepRef.current === "review") {
        setStep("time")
        toast.info("That time has started. Pick another one.")
      }
    }, 30_000)
    return () => clearInterval(intervalId)
  }, [clearSelection])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const data = await fetchBookingBootstrap()
        if (!mounted) return
        setLocations(data)
        if (data[0]) setSelectedLocationId(data[0].id)
        setStep(data.length > 1 ? "venue" : "time")
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

  // Free times reload whenever the time step shows or a choice changes.
  // A reply for older choices is dropped so it can't overwrite newer ones.
  useEffect(() => {
    if (step !== "time" || !selectedLocationId) return
    let cancelled = false
    const key = availabilityKey

    async function load() {
      try {
        const data = await fetchAvailability({
          locationId: selectedLocationId,
          date: selectedDate,
          durationMinutes,
          groupSize,
        })
        if (cancelled) return
        setSlots(data)

        const currentSlot = latestSelectedSlotRef.current
        if (!currentSlot) return
        const matchingSlot =
          data.find((slot) => slot.startsAt === currentSlot.startsAt && slot.isAvailable) ?? null
        if (matchingSlot) {
          setSelectedSlot(matchingSlot)
        } else {
          clearSelection()
        }
      } catch (error) {
        if (!cancelled) toast.apiError(error, "Could not load free times.")
      } finally {
        if (!cancelled) setLoadedAvailabilityKey(key)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [availabilityKey, clearSelection, durationMinutes, groupSize, selectedDate, selectedLocationId, step])

  const loadQuote = useCallback(async () => {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) return null

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
      toast.apiError(error, "Could not work out the price.")
      setQuote(null)
      return null
    } finally {
      setIsLoadingQuote(false)
    }
  }, [durationMinutes, groupSize, selectedLocationId, selectedResourceId, selectedSlot])

  function handleDateChange(dateKey: string) {
    setSelectedDate(dateKey)
    clearSelection()
  }

  function handleDurationChange(value: 30 | 60) {
    setDurationMinutes(value)
    clearSelection()
  }

  function handleGroupSizeChange(size: GroupSize) {
    setGroupSize(size)
    setQuote(null)
  }

  async function handlePlayersContinue() {
    const nextQuote = await loadQuote()
    if (nextQuote) setStep("review")
  }

  async function handleConfirm() {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      toast.error("Pick a time to continue.")
      setStep("time")
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
    } catch (error) {
      if (error instanceof ApiError && error.code === "SLOT_UNAVAILABLE") {
        haptics.error()
        toast.error("That time was just taken. Pick another one below.")
        clearSelection()
        setStep("time")
        return
      }
      toast.apiError(error, "Could not complete your booking.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePaid = useCallback(() => {
    setConfirmation((current) =>
      current ? { ...current, status: "confirmed", paymentStatus: "paid" } : current,
    )
    haptics.success()
    setStep("done")
  }, [])

  const handleHoldExpired = useCallback(() => {
    toast.error("Your hold ran out. Pick a time again.")
    setConfirmation(null)
    clearSelection()
    setStep("time")
  }, [clearSelection])

  function handleBookAnother() {
    setConfirmation(null)
    setNotes("")
    clearSelection()
    setStep(singleVenue ? "time" : "venue")
  }

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(PLAY_HREF)
  }, [])

  // Back inside the flow keeps every choice; from the first step it leaves.
  const previousStep: FlowStep | null =
    stepIndex > 0 && (step === "time" || step === "players" || step === "review")
      ? flowSteps[stepIndex - 1]
      : null

  const goBack = useCallback(() => {
    if (previousStep) setStep(previousStep)
    else leave()
  }, [leave, previousStep])

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!previousStep) return false
      setStep(previousStep)
      return true
    })
    return () => subscription.remove()
  }, [previousStep])

  const backLabel = previousStep
    ? STEP_BACK_LABELS[previousStep] ?? "Back"
    : router.canGoBack()
      ? "Back"
      : "Play"

  const estimatedTotal = selectedSlot
    ? selectedSlot.price.totalAmount + extraPlayerSurcharge(groupSize)
    : null
  const currency = selectedSlot?.price.currency ?? "KES"

  const priceBar = (label: string, amount: number | null, action: ReactNode) => (
    <View style={styles.footer}>
      <View style={styles.footerPrice}>
        <AppText variant="footnote" color="secondaryLabel">
          {label}
        </AppText>
        <AppText variant="title3" tabular>
          {amount === null ? "—" : formatKes(amount, currency)}
        </AppText>
      </View>
      {action}
    </View>
  )

  const footer =
    step === "time"
      ? priceBar(
          "Price",
          selectedSlot?.price.totalAmount ?? null,
          <Button
            label="Continue"
            fullWidth={false}
            disabled={!selectedSlot}
            accessibilityHint={selectedSlot ? undefined : "Pick a time first"}
            onPress={() => setStep("players")}
          />,
        )
      : step === "players"
        ? priceBar(
            "Total",
            estimatedTotal,
            <Button
              label="Continue"
              fullWidth={false}
              loading={isLoadingQuote}
              onPress={() => void handlePlayersContinue()}
            />,
          )
        : step === "review"
          ? priceBar(
              "Total",
              quote?.totalAmount ?? estimatedTotal,
              <Button
                label="Book and pay"
                fullWidth={false}
                loading={isSubmitting}
                onPress={() => void handleConfirm()}
              />,
            )
          : undefined

  const venueName = selectedLocation?.name ?? "PlayTT"

  return (
    <Screen
      title="Book a table"
      subtitle={step === "venue" ? undefined : venueName}
      back={{ label: backLabel, onPress: goBack }}
      footer={footer}
    >
      {isBootstrapping ? (
        <VenueCardSkeleton surface={skeletonSurface} />
      ) : locations.length === 0 ? (
        <EmptyState
          icon="location.fill"
          title="No places to play yet"
          message="We're opening tables soon. Check back in a few days."
          action={{ label: "Back to Play", onPress: leave }}
        />
      ) : (
        <>
          {stepIndex >= 0 ? (
            <StepHeader step={stepIndex + 1} total={flowSteps.length} title={STEP_TITLES[step]} />
          ) : (
            <AppText variant="title2" accessibilityRole="header">
              {STEP_TITLES[step]}
            </AppText>
          )}

          {step === "venue" ? (
            <ListSection>
              {locations.map((location) => (
                <ListRow
                  key={location.id}
                  icon="location.fill"
                  title={location.name}
                  subtitle={location.address}
                  onPress={() => {
                    if (location.id !== selectedLocationId) clearSelection()
                    setSelectedLocationId(location.id)
                    setStep("time")
                  }}
                />
              ))}
            </ListSection>
          ) : null}

          {step === "time" ? (
            <View style={styles.section}>
              <DateStrip days={dateStrip} selectedDate={selectedDate} onChange={handleDateChange} />
              <ChoiceChips
                label="Game length"
                options={DURATION_OPTIONS}
                value={durationMinutes}
                onChange={handleDurationChange}
              />
              <TimeGrid
                slots={slots}
                selectedSlot={selectedSlot}
                nowMs={nowMs}
                isLoading={isLoadingSlots}
                onSelect={setSelectedSlot}
                onTryTomorrow={() => handleDateChange(addDaysToDateKey(selectedDate, 1))}
              />
            </View>
          ) : null}

          {step === "players" ? (
            <Card>
              <PlayerStepper value={groupSize} onChange={handleGroupSizeChange} />
              <AppText variant="callout" color="secondaryLabel" style={styles.center}>
                Up to {INCLUDED_PLAYERS} players are included. Each extra player adds{" "}
                {formatKes(EXTRA_PLAYER_SURCHARGE, currency)}.
              </AppText>
            </Card>
          ) : null}

          {step === "review" && selectedSlot ? (
            <View style={styles.section}>
              <BookingSummary
                venue={venueName}
                startIso={selectedSlot.startsAt}
                endIso={selectedSlot.endsAt}
                players={groupSize}
                total={formatKes(quote?.totalAmount ?? estimatedTotal ?? 0, quote?.currency ?? currency)}
              />
              <View style={styles.notes}>
                <AppText variant="footnote" color="secondaryLabel" nativeID="booking-notes-label" style={styles.notesLabel}>
                  Anything we should know? (optional)
                </AppText>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={280}
                  placeholder="For example, a birthday game or a coach joining"
                  placeholderTextColor={colors.tertiaryLabel}
                  accessibilityLabel="Note for the venue, optional"
                  accessibilityLabelledBy="booking-notes-label"
                  style={[styles.notesInput, { backgroundColor: colors.surface, color: colors.label }]}
                />
              </View>
            </View>
          ) : null}

          {step === "pay" && confirmation && selectedSlot ? (
            <PayStep
              confirmation={confirmation}
              venue={venueName}
              startIso={selectedSlot.startsAt}
              endIso={selectedSlot.endsAt}
              players={groupSize}
              onConfirmed={handlePaid}
              onExpired={handleHoldExpired}
            />
          ) : null}

          {step === "done" && confirmation && selectedSlot ? (
            <View style={styles.section}>
              <View style={styles.doneMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={[styles.doneCircle, { backgroundColor: colors.success }]}>
                  <IconSymbol name="checkmark" size={44} color={colors.surface} />
                </View>
              </View>
              <AppText variant="body" color="secondaryLabel" style={styles.center}>
                See you at the table. Your entry code is in Bookings.
              </AppText>
              <BookingSummary
                venue={venueName}
                startIso={selectedSlot.startsAt}
                endIso={selectedSlot.endsAt}
                players={groupSize}
                total={formatKes(confirmation.totalAmount, confirmation.currency)}
              />
              <Button label="See my bookings" onPress={() => router.replace(BOOKINGS_HREF)} />
              <Button label="Book another table" variant="secondary" onPress={handleBookAnother} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { gap: PlayTTSpacing.lg },
  center: { textAlign: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PlayTTSpacing.md,
  },
  footerPrice: { flexShrink: 1 },
  notes: { gap: PlayTTSpacing.xs },
  notesLabel: { paddingHorizontal: PlayTTSpacing.md },
  notesInput: {
    minHeight: 96,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: PlayTTSpacing.md,
    fontSize: 17,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  doneMark: { alignItems: "center", paddingTop: PlayTTSpacing.md },
  doneCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
})
