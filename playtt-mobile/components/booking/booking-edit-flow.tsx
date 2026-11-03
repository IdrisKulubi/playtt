import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BookingEditIntentStep } from "@/components/booking/booking-edit-intent-sheet"
import { BookingEditReviewStep } from "@/components/booking/booking-edit-review-sheet"
import { BookingEditTimeStep } from "@/components/booking/booking-edit-time-sheet"
import { GroupSizeStep } from "@/components/booking/group-size-sheet"
import { Button } from "@/components/kit/button"
import { Sheet } from "@/components/kit/sheet"
import { useModificationCheckout } from "@/hooks/use-modification-checkout"
import {
  applyBookingModification,
  fetchAvailability,
  fetchBookingById,
  quoteBookingModification,
} from "@/lib/booking-api"
import type {
  GroupSize,
  LocationSummary,
  ModificationPreview,
  SlotAvailability,
  UserBookingSummary,
} from "@/lib/booking-types"
import {
  buildDateStripAround,
  isSlotStartInPast,
  toDateKey,
} from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

type EditStep = "intent" | "time" | "players" | "review" | "closed"

const STEP_TITLES: Record<Exclude<EditStep, "closed">, string> = {
  intent: "Change booking",
  time: "Change time",
  players: "Change players",
  review: "Check your changes",
}

type BookingEditFlowProps = {
  booking: UserBookingSummary
  visible: boolean
  onClose: () => void
  onUpdated: (booking: UserBookingSummary) => void
}

function pickSlotForDate(
  slots: SlotAvailability[],
  dateKey: string,
  preferredStartIso: string | null,
  nowMs: number
) {
  const available = slots.filter(
    (slot) =>
      slot.startsAt.startsWith(dateKey) &&
      slot.isAvailable &&
      !isSlotStartInPast(slot.startsAt, nowMs)
  )

  if (available.length === 0) {
    return null
  }

  if (preferredStartIso) {
    const match = available.find((slot) => slot.startsAt === preferredStartIso)
    if (match) {
      return match
    }
  }

  return available[0] ?? null
}

export function BookingEditFlow({
  booking,
  visible,
  onClose,
  onUpdated,
}: BookingEditFlowProps) {
  const [step, setStep] = useState<EditStep>("closed")
  const [changeTime, setChangeTime] = useState(false)
  const [addPlayers, setAddPlayers] = useState(false)

  const [selectedDateKey, setSelectedDateKey] = useState(
    toDateKey(new Date(booking.startTime))
  )
  const [selectedStartIso, setSelectedStartIso] = useState(booking.startTime)
  const [groupSize, setGroupSize] = useState<GroupSize>(
    booking.groupSize as GroupSize
  )
  const [slots, setSlots] = useState<SlotAvailability[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [preview, setPreview] = useState<ModificationPreview | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())
  const selectedStartIsoRef = useRef(selectedStartIso)

  useEffect(() => {
    selectedStartIsoRef.current = selectedStartIso
  }, [selectedStartIso])

  const dateStrip = useMemo(
    () => buildDateStripAround(new Date(booking.startTime), 7),
    [booking.startTime]
  )

  const location = useMemo<LocationSummary>(
    () => ({
      id: booking.locationId,
      name: booking.locationName,
      slug: "",
      timezone: "",
      address: "",
      resources: [],
    }),
    [booking.locationId, booking.locationName]
  )

  const durationMinutes = booking.durationMinutes as 30 | 60
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startsAt === selectedStartIso) ?? null,
    [selectedStartIso, slots]
  )

  const resetState = useCallback(() => {
    setChangeTime(false)
    setAddPlayers(false)
    setSelectedDateKey(toDateKey(new Date(booking.startTime)))
    setSelectedStartIso(booking.startTime)
    setGroupSize(booking.groupSize as GroupSize)
    setSlots([])
    setPreview(null)
    setIsQuoting(false)
  }, [booking.groupSize, booking.startTime])

  const handleClose = useCallback(() => {
    setStep("closed")
    onClose()
  }, [onClose])

  // Close the parent once, after the sheet's own close animation has run.
  // (InteractionManager no longer exists in this React Native version, and
  // the old code also closed twice when it did.)
  const scheduleParentClose = useCallback(() => {
    setTimeout(() => onClose(), 350)
  }, [onClose])

  const { isApplying, isConfirming, confirmLabel, applyModificationResult } =
    useModificationCheckout({
      bookingId: booking.id,
      onApplied: async () => {
        setStep("closed")

        const updated = await fetchBookingById(booking.id)
        if (updated) {
          onUpdated(updated)
        }
        toast.success("Booking updated.")

        scheduleParentClose()
      },
    })

  // Every time the parent opens the flow, start fresh at the first step.
  const [wasVisible, setWasVisible] = useState(false)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      resetState()
      setStep("intent")
    } else {
      setStep("closed")
    }
  }

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const loadSlots = useCallback(async () => {
    if (step !== "time" && !(step === "review" && changeTime)) {
      return
    }

    setIsLoadingSlots(true)

    try {
      const data = await fetchAvailability({
        locationId: booking.locationId,
        date: selectedDateKey,
        durationMinutes,
        groupSize,
      })
      setSlots(data)

      const preferred = selectedStartIsoRef.current
      const nextSlot = pickSlotForDate(
        data,
        selectedDateKey,
        preferred || null,
        Date.now()
      )

      if (nextSlot) {
        if (nextSlot.startsAt !== preferred) {
          setSelectedStartIso(nextSlot.startsAt)
        }
      } else if (preferred && !preferred.startsWith(selectedDateKey)) {
        setSelectedStartIso("")
      }
    } catch (error) {
      toast.apiError(error, "Could not load times.")
    } finally {
      setIsLoadingSlots(false)
    }
  }, [
    booking.locationId,
    changeTime,
    durationMinutes,
    groupSize,
    selectedDateKey,
    step,
  ])

  useEffect(() => {
    if (step === "time" || (step === "review" && changeTime)) {
      void loadSlots()
    }
  }, [changeTime, loadSlots, step])

  const refreshPreview = useCallback(async () => {
    if (step !== "review") {
      return
    }

    setIsQuoting(true)

    try {
      const body: {
        startTimeIso?: string
        groupSize?: number
      } = {}

      if (changeTime && selectedStartIso !== booking.startTime) {
        body.startTimeIso = selectedStartIso
      }

      if (addPlayers && groupSize !== booking.groupSize) {
        body.groupSize = groupSize
      }

      if (!body.startTimeIso && !body.groupSize) {
        setPreview(null)
        return
      }

      const result = await quoteBookingModification(booking.id, body)
      setPreview(result)
    } catch (error) {
      toast.apiError(error, "Could not calculate new total.")
      setPreview(null)
    } finally {
      setIsQuoting(false)
    }
  }, [
    addPlayers,
    booking.groupSize,
    booking.id,
    booking.startTime,
    changeTime,
    groupSize,
    selectedStartIso,
    step,
  ])

  useEffect(() => {
    if (step === "review") {
      void refreshPreview()
    }
  }, [refreshPreview, step])

  function handleToggleIntent(intent: "time" | "players") {
    if (intent === "time") {
      setChangeTime((value) => !value)
      return
    }

    setAddPlayers((value) => !value)
  }

  function handleIntentContinue() {
    if (changeTime) {
      setStep("time")
      return
    }

    if (addPlayers) {
      setStep("players")
    }
  }

  function handleTimeContinue() {
    if (selectedStartIso === booking.startTime) {
      if (addPlayers) {
        setStep("players")
        return
      }

      toast.info("Pick a different time to continue.")
      return
    }

    if (addPlayers) {
      setStep("players")
      return
    }

    setStep("review")
  }

  function handlePlayersContinue() {
    const playersChanged = addPlayers && groupSize !== booking.groupSize
    const timeChanged = changeTime && selectedStartIso !== booking.startTime

    if (!playersChanged && !timeChanged) {
      toast.info("Pick a different group size to continue.")
      return
    }

    setStep("review")
  }

  // One step back, skipping the steps the player didn't choose.
  function handleBack() {
    if (step === "review") setStep(addPlayers ? "players" : "time")
    else if (step === "players") setStep(changeTime ? "time" : "intent")
    else setStep("intent")
  }

  function handleDateChange(dateKey: string) {
    setSelectedDateKey(dateKey)
    setSelectedStartIso("")
  }

  async function handleConfirm() {
    if (!preview) {
      return
    }

    const body: {
      startTimeIso?: string
      groupSize?: number
    } = {}

    if (changeTime && selectedStartIso !== booking.startTime) {
      body.startTimeIso = selectedStartIso
    }

    if (addPlayers && groupSize !== booking.groupSize) {
      body.groupSize = groupSize
    }

    try {
      const result = await applyBookingModification(booking.id, body)
      await applyModificationResult(result)
    } catch (error) {
      toast.apiError(error, "Could not apply changes.")
    }
  }

  // One sheet for every step: the content swaps in place. Separate sheets
  // can't hand over on iOS, because a new one can't open while the last one
  // is still closing, so Continue used to just close everything.
  return (
    <Sheet
      visible={visible && step !== "closed"}
      title={step === "closed" ? STEP_TITLES.intent : STEP_TITLES[step]}
      detents={["content"]}
      scrollable
      onClose={handleClose}
    >
      {step === "intent" ? (
        <BookingEditIntentStep
          changeTime={changeTime}
          addPlayers={addPlayers}
          onToggle={handleToggleIntent}
          onContinue={handleIntentContinue}
        />
      ) : step === "time" ? (
        <BookingEditTimeStep
          location={location}
          dateStrip={dateStrip}
          selectedDate={selectedDateKey}
          durationMinutes={durationMinutes}
          slots={slots}
          selectedSlot={selectedSlot}
          isLoadingSlots={isLoadingSlots}
          nowMs={nowMs}
          onDateChange={handleDateChange}
          onSlotSelect={(slot) => setSelectedStartIso(slot.startsAt)}
          onContinue={handleTimeContinue}
        />
      ) : step === "players" ? (
        <GroupSizeStep
          groupSize={groupSize}
          currency={booking.currency}
          continueLabel="Continue"
          hint="You can reduce players until 2 hours before play. If the total drops, PlayTT keeps the difference as credit on your account."
          onGroupSizeChange={setGroupSize}
          onContinue={handlePlayersContinue}
        />
      ) : step === "review" ? (
        <BookingEditReviewStep
          booking={booking}
          preview={preview}
          isQuoting={isQuoting}
          isApplying={isApplying}
          isConfirming={isConfirming}
          confirmLabel={confirmLabel}
          onConfirm={() => void handleConfirm()}
        />
      ) : null}

      {step === "time" || step === "players" || step === "review" ? (
        <Button
          label="Back"
          variant="plain"
          disabled={isApplying || isConfirming}
          onPress={handleBack}
        />
      ) : null}
    </Sheet>
  )
}
