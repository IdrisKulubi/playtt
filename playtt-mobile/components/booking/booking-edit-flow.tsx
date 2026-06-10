import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { InteractionManager } from "react-native"

import { BookingEditIntentSheet } from "@/components/booking/booking-edit-intent-sheet"
import { BookingEditReviewSheet } from "@/components/booking/booking-edit-review-sheet"
import { BookingEditTimeSheet } from "@/components/booking/booking-edit-time-sheet"
import { GroupSizeSheet } from "@/components/booking/group-size-sheet"
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
  nowMs: number,
) {
  const available = slots.filter(
    (slot) =>
      slot.startsAt.startsWith(dateKey) &&
      slot.isAvailable &&
      !isSlotStartInPast(slot.startsAt, nowMs),
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
    toDateKey(new Date(booking.startTime)),
  )
  const [selectedStartIso, setSelectedStartIso] = useState(booking.startTime)
  const [groupSize, setGroupSize] = useState<GroupSize>(
    booking.groupSize as GroupSize,
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
    [booking.startTime],
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
    [booking.locationId, booking.locationName],
  )

  const durationMinutes = booking.durationMinutes as 30 | 60
  const minGroupSize = booking.groupSize as GroupSize

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.startsAt === selectedStartIso) ?? null,
    [selectedStartIso, slots],
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

  const scheduleParentClose = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      onClose()
    })
    setTimeout(() => onClose(), 350)
  }, [onClose])

  const {
    isApplying,
    isConfirming,
    confirmLabel,
    applyModificationResult,
  } = useModificationCheckout({
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

  const wasVisibleRef = useRef(false)

  useEffect(() => {
    if (!visible) {
      setStep("closed")
      wasVisibleRef.current = false
      return
    }

    if (!wasVisibleRef.current) {
      resetState()
      setStep("intent")
    }

    wasVisibleRef.current = true
  }, [visible, resetState])

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
        Date.now(),
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
      toast.info("Add at least one more player to continue.")
      return
    }

    setStep("review")
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

  return (
    <>
      <BookingEditIntentSheet
        visible={visible && step === "intent"}
        changeTime={changeTime}
        addPlayers={addPlayers}
        onClose={handleClose}
        onToggle={handleToggleIntent}
        onContinue={handleIntentContinue}
      />

      <BookingEditTimeSheet
        visible={visible && step === "time"}
        location={location}
        dateStrip={dateStrip}
        selectedDate={selectedDateKey}
        durationMinutes={durationMinutes}
        slots={slots}
        selectedSlot={selectedSlot}
        isLoadingSlots={isLoadingSlots}
        nowMs={nowMs}
        onClose={handleClose}
        onDateChange={handleDateChange}
        onSlotSelect={(slot) => setSelectedStartIso(slot.startsAt)}
        onContinue={handleTimeContinue}
      />

      <GroupSizeSheet
        visible={visible && step === "players"}
        groupSize={groupSize}
        currency={booking.currency}
        minGroupSize={minGroupSize}
        title="Add players"
        continueLabel="Continue"
        hint="You can add players, not remove them."
        onClose={handleClose}
        onGroupSizeChange={setGroupSize}
        onContinue={handlePlayersContinue}
      />

      <BookingEditReviewSheet
        visible={visible && step === "review"}
        booking={booking}
        preview={preview}
        isQuoting={isQuoting}
        isApplying={isApplying}
        isConfirming={isConfirming}
        confirmLabel={confirmLabel}
        onClose={handleClose}
        onConfirm={() => void handleConfirm()}
      />
    </>
  )
}
