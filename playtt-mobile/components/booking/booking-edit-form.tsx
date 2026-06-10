import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { createBookingFlowStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  applyBookingModification,
  fetchAvailability,
  fetchBookingById,
  fetchModificationStatus,
  quoteBookingModification,
} from "@/lib/booking-api"
import type {
  ModificationPreview,
  UserBookingSummary,
} from "@/lib/booking-types"
import {
  addDaysToDateKey,
  formatDateChipLabel,
  formatKes,
  formatTimeRange,
  slotSubtitle,
  toDateKey,
} from "@/lib/booking-utils"
import { openPaymentCheckout } from "@/lib/payment-browser"
import { toast } from "@/lib/toast"

type BookingEditFormProps = {
  booking: UserBookingSummary
  onUpdated: (booking: UserBookingSummary) => void
}

export function BookingEditForm({ booking, onUpdated }: BookingEditFormProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createBookingFlowStyles(theme), [theme])
  const localStyles = useMemo(() => createLocalStyles(theme.muted), [theme])

  const [selectedDateKey, setSelectedDateKey] = useState(
    toDateKey(new Date(booking.startTime)),
  )
  const [selectedStartIso, setSelectedStartIso] = useState(booking.startTime)
  const [groupSize, setGroupSize] = useState(booking.groupSize)
  const [slots, setSlots] = useState<
    Awaited<ReturnType<typeof fetchAvailability>>
  >([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [preview, setPreview] = useState<ModificationPreview | null>(null)
  const [isQuoting, setIsQuoting] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())

  const dateOptions = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return toDateKey(day)
    })
  }, [])

  const playerOptions = useMemo(
    () =>
      Array.from({ length: 8 - booking.groupSize + 1 }, (_, index) =>
        booking.groupSize + index,
      ),
    [booking.groupSize],
  )

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const loadSlots = useCallback(async () => {
    setIsLoadingSlots(true)

    try {
      const data = await fetchAvailability({
        locationId: booking.locationId,
        date: selectedDateKey,
        durationMinutes: booking.durationMinutes as 30 | 60,
        groupSize,
      })
      setSlots(data)
    } catch (error) {
      toast.apiError(error, "Could not load times.")
    } finally {
      setIsLoadingSlots(false)
    }
  }, [booking.durationMinutes, booking.locationId, groupSize, selectedDateKey])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  const refreshPreview = useCallback(async () => {
    setIsQuoting(true)

    try {
      const body: {
        startTimeIso?: string
        groupSize?: number
      } = {}

      if (selectedStartIso !== booking.startTime) {
        body.startTimeIso = selectedStartIso
      }

      if (groupSize !== booking.groupSize) {
        body.groupSize = groupSize
      }

      if (!body.startTimeIso && !body.groupSize) {
        setPreview(null)
        return
      }

      const result = await quoteBookingModification(booking.id, body)
      setPreview(result)
    } catch (error) {
      toast.apiError(error, "Could not preview changes.")
      setPreview(null)
    } finally {
      setIsQuoting(false)
    }
  }, [booking.groupSize, booking.id, booking.startTime, groupSize, selectedStartIso])

  useEffect(() => {
    void refreshPreview()
  }, [refreshPreview])

  async function pollModification(modificationId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await fetchModificationStatus(booking.id, modificationId)

      if (status?.applied) {
        const updated = await fetchBookingById(booking.id)
        if (updated) {
          onUpdated(updated)
        }
        toast.success("Booking updated.")
        return true
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return false
  }

  async function handleConfirm() {
    if (!preview) {
      return
    }

    setIsApplying(true)

    try {
      const body: {
        startTimeIso?: string
        groupSize?: number
      } = {}

      if (selectedStartIso !== booking.startTime) {
        body.startTimeIso = selectedStartIso
      }

      if (groupSize !== booking.groupSize) {
        body.groupSize = groupSize
      }

      const result = await applyBookingModification(booking.id, body)

      if (!result.requiresPayment) {
        const updated = await fetchBookingById(booking.id)
        if (updated) {
          onUpdated(updated)
        }
        toast.success("Booking updated.")
        return
      }

      if (!result.authorizationUrl || !result.returnUrl) {
        throw new Error("Payment checkout URL was missing.")
      }

      const browserResult = await openPaymentCheckout(
        result.authorizationUrl,
        result.returnUrl,
      )

      if (browserResult.type === "cancel") {
        const applied = await pollModification(result.modificationId)
        if (!applied) {
          toast.info("Payment not completed. Your booking was not changed.")
        }
        return
      }

      await pollModification(result.modificationId)
    } catch (error) {
      toast.apiError(error, "Could not apply changes.")
    } finally {
      setIsApplying(false)
    }
  }

  const hasChanges =
    selectedStartIso !== booking.startTime || groupSize !== booking.groupSize

  return (
    <ScrollView contentContainerStyle={localStyles.scroll}>
      <Text style={styles.confirmedTitle}>Change time</Text>
      <Text style={styles.confirmedBody}>
        Pick a new slot. We will check availability before saving.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={localStyles.dateRow}>
          {dateOptions.map((dateKey) => {
            const active = dateKey === selectedDateKey
            return (
              <Pressable
                key={dateKey}
                onPress={() => setSelectedDateKey(dateKey)}
                style={[localStyles.dateChip, active && localStyles.dateChipActive]}
              >
                <Text
                  style={[
                    localStyles.dateChipText,
                    active && localStyles.dateChipTextActive,
                  ]}
                >
                  {formatDateChipLabel(new Date(`${dateKey}T12:00:00`))}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      {isLoadingSlots ? (
        <ActivityIndicator color={PlayTTColors.primary} />
      ) : (
        <View style={localStyles.slotList}>
          {slots.map((slot) => {
            const active = slot.startsAt === selectedStartIso
            const disabled = !slot.isAvailable

            return (
              <Pressable
                key={slot.startsAt}
                disabled={disabled}
                onPress={() => setSelectedStartIso(slot.startsAt)}
                style={[
                  localStyles.slotRow,
                  active && localStyles.slotRowActive,
                  disabled && localStyles.slotRowDisabled,
                ]}
              >
                <Text style={localStyles.slotTime}>
                  {new Date(slot.startsAt).toLocaleTimeString("en-KE", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={localStyles.slotMeta}>
                  {slotSubtitle(slot, nowMs)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      <Text style={[styles.confirmedTitle, localStyles.sectionTitle]}>
        Add players
      </Text>
      <Text style={styles.confirmedBody}>
        You can add players, not remove them.
      </Text>

      <View style={localStyles.playerRow}>
        {playerOptions.map((size) => {
          const active = size === groupSize
          return (
            <Pressable
              key={size}
              onPress={() => setGroupSize(size)}
              style={[localStyles.playerChip, active && localStyles.playerChipActive]}
            >
              <Text
                style={[
                  localStyles.playerChipText,
                  active && localStyles.playerChipTextActive,
                ]}
              >
                {size}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {isQuoting ? (
        <View style={localStyles.previewRow}>
          <ActivityIndicator color={PlayTTColors.primary} size="small" />
          <Text style={localStyles.previewText}>Updating price…</Text>
        </View>
      ) : preview ? (
        <View style={localStyles.previewCard}>
          <Text style={localStyles.previewTitle}>Review changes</Text>
          <Text style={localStyles.previewLine}>
            {formatTimeRange(preview.newStartTime, preview.newEndTime)}
          </Text>
          <Text style={localStyles.previewLine}>
            {preview.newGroupSize} players · {preview.newResourceName}
          </Text>
          <Text style={localStyles.previewPrice}>
            New total: {formatKes(preview.newTotal, preview.currency)}
          </Text>
          {Number(preview.deltaAmount) > 0 ? (
            <Text style={localStyles.previewDelta}>
              Due today: {formatKes(preview.deltaAmount, preview.currency)}
            </Text>
          ) : (
            <Text style={localStyles.previewDelta}>No extra payment needed</Text>
          )}
        </View>
      ) : null}

      <Button
        label={
          preview && Number(preview.deltaAmount) > 0
            ? `Pay ${formatKes(preview.deltaAmount, preview.currency)} and confirm`
            : "Confirm changes"
        }
        surface="product"
        productTheme={theme}
        onPress={() => void handleConfirm()}
        loading={isApplying}
        disabled={!hasChanges || !preview || isQuoting}
      />

      <Button
        label="Try tomorrow"
        variant="outline"
        surface="product"
        productTheme={theme}
        onPress={() => setSelectedDateKey(addDaysToDateKey(selectedDateKey, 1))}
      />
    </ScrollView>
  )
}

function createLocalStyles(muted: string) {
  return StyleSheet.create({
    scroll: {
      gap: PlayTTSpacing.md,
      paddingBottom: PlayTTSpacing.xl,
    },
    sectionTitle: {
      marginTop: PlayTTSpacing.md,
    },
    dateRow: {
      flexDirection: "row",
      gap: PlayTTSpacing.sm,
    },
    dateChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: muted,
      paddingHorizontal: PlayTTSpacing.md,
      paddingVertical: PlayTTSpacing.sm,
    },
    dateChipActive: {
      borderColor: PlayTTColors.primary,
      backgroundColor: "rgba(0, 183, 255, 0.12)",
    },
    dateChipText: {
      fontFamily: PlayTTFontFamilies.medium,
      color: muted,
    },
    dateChipTextActive: {
      color: PlayTTColors.primary,
    },
    slotList: {
      gap: PlayTTSpacing.sm,
    },
    slotRow: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: muted,
      padding: PlayTTSpacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    slotRowActive: {
      borderColor: PlayTTColors.primary,
      backgroundColor: "rgba(0, 183, 255, 0.08)",
    },
    slotRowDisabled: {
      opacity: 0.45,
    },
    slotTime: {
      fontFamily: PlayTTFontFamilies.semiBold,
      fontSize: 16,
    },
    slotMeta: {
      fontFamily: PlayTTFontFamilies.regular,
      color: muted,
      fontSize: 13,
    },
    playerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: PlayTTSpacing.sm,
    },
    playerChip: {
      minWidth: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: muted,
      paddingHorizontal: PlayTTSpacing.md,
      paddingVertical: PlayTTSpacing.sm,
      alignItems: "center",
    },
    playerChipActive: {
      borderColor: PlayTTColors.primary,
      backgroundColor: "rgba(0, 183, 255, 0.12)",
    },
    playerChipText: {
      fontFamily: PlayTTFontFamilies.semiBold,
    },
    playerChipTextActive: {
      color: PlayTTColors.primary,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: PlayTTSpacing.sm,
    },
    previewText: {
      color: muted,
      fontFamily: PlayTTFontFamilies.regular,
    },
    previewCard: {
      gap: PlayTTSpacing.xs,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: muted,
      padding: PlayTTSpacing.md,
    },
    previewTitle: {
      fontFamily: PlayTTFontFamilies.semiBold,
      fontSize: 16,
    },
    previewLine: {
      fontFamily: PlayTTFontFamilies.regular,
      color: muted,
    },
    previewPrice: {
      fontFamily: PlayTTFontFamilies.semiBold,
      fontSize: 16,
      marginTop: PlayTTSpacing.xs,
    },
    previewDelta: {
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
    },
  })
}
