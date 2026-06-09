import { router } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
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
  formatPricingTierLabel,
  formatTimeRange,
  isSlotStartInPast,
  slotSubtitle,
  toDateKey,
} from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

const STEP_LABELS: Record<BookingStep, string> = {
  location: "Choose a venue",
  timing: "Pick a time",
  checkout: "Review booking",
  confirmed: "Booking reserved",
}

const GROUP_SIZE_OPTIONS: GroupSize[] = [2, 3, 4, 5, 6, 7, 8]

export function BookingFlow() {
  const [step, setStep] = useState<BookingStep>("location")
  const [locations, setLocations] = useState<LocationSummary[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(60)
  const [groupSize, setGroupSize] = useState<GroupSize>(2)
  const [slots, setSlots] = useState<SlotAvailability[]>([])
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null)
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [notes, setNotes] = useState("")
  const [confirmation, setConfirmation] = useState<CreateBookingResult | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())

  const dateStrip = useMemo(() => buildDateStrip(7), [])
  const selectedLocation = locations.find((item) => item.id === selectedLocationId) ?? null
  const selectedResourceId =
    selectedSlot?.availableResourceIds[0] ??
    selectedLocation?.resources[0]?.id ??
    ""

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const data = await fetchBookingBootstrap()
        if (!mounted) return
        setLocations(data)
        setSelectedLocationId(data[0]?.id ?? "")
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

    setIsLoading(true)
    try {
      const data = await fetchAvailability({
        locationId: selectedLocationId,
        date: selectedDate,
        durationMinutes,
        groupSize,
      })
      setSlots(data)
      setSelectedSlot((current) => {
        if (!current) return null
        return (
          data.find(
            (slot) => slot.startsAt === current.startsAt && slot.isAvailable,
          ) ?? null
        )
      })
    } catch (error) {
      toast.apiError(error, "Could not load availability.")
    } finally {
      setIsLoading(false)
    }
  }, [durationMinutes, groupSize, selectedDate, selectedLocationId])

  useEffect(() => {
    if (step !== "timing" || !selectedLocationId) return
    void loadAvailability()
  }, [loadAvailability, selectedLocationId, step])

  useEffect(() => {
    if (step !== "checkout" || !selectedSlot || !selectedResourceId) return

    let mounted = true

    async function loadQuote() {
      setIsLoading(true)
      try {
        const data = await fetchBookingQuote({
          locationId: selectedLocationId,
          resourceId: selectedResourceId,
          startTimeIso: selectedSlot!.startsAt,
          durationMinutes,
          groupSize,
        })
        if (mounted) setQuote(data)
      } catch (error) {
        toast.apiError(error, "Could not calculate price.")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadQuote()
    return () => {
      mounted = false
    }
  }, [
    durationMinutes,
    groupSize,
    selectedLocationId,
    selectedResourceId,
    selectedSlot,
    step,
  ])

  async function handleConfirm() {
    if (!selectedSlot || !selectedLocationId || !selectedResourceId) {
      toast.error("Select a venue and an available time to continue.")
      return
    }

    setIsLoading(true)
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
      setStep("confirmed")
      toast.success("Reservation saved.")
    } catch (error) {
      toast.apiError(error, "Could not complete your booking.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isBootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PlayTTColors.primary} />
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>

        {step === "location" ? (
          <View style={styles.section}>
            {locations.map((location) => {
              const selected = location.id === selectedLocationId
              return (
                <Pressable
                  key={location.id}
                  onPress={() => setSelectedLocationId(location.id)}
                  style={[styles.card, selected && styles.cardSelected]}
                >
                  <Text style={styles.cardTitle}>{location.name}</Text>
                  <Text style={styles.cardBody}>{location.address}</Text>
                  <Text style={styles.cardMeta}>
                    {location.resources.length} table
                    {location.resources.length === 1 ? "" : "s"}
                  </Text>
                </Pressable>
              )
            })}
            <Button
              label="Continue"
              surface="product"
              onPress={() => setStep("timing")}
              disabled={!selectedLocationId}
            />
          </View>
        ) : null}

        {step === "timing" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{selectedLocation?.name}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.dateRow}>
                {dateStrip.map((day) => {
                  const key = toDateKey(day)
                  const selected = key === selectedDate
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSelectedDate(key)}
                      style={[styles.dateChip, selected && styles.dateChipSelected]}
                    >
                      <Text
                        style={[
                          styles.dateChipDay,
                          selected && styles.dateChipTextSelected,
                        ]}
                      >
                        {day.toLocaleDateString("en-KE", { weekday: "short" })}
                      </Text>
                      <Text
                        style={[
                          styles.dateChipDate,
                          selected && styles.dateChipTextSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </ScrollView>

            <View style={styles.toggleRow}>
              {[30, 60].map((value) => {
                const selected = durationMinutes === value
                return (
                  <Pressable
                    key={value}
                    onPress={() => setDurationMinutes(value as 30 | 60)}
                    style={[styles.toggle, selected && styles.toggleSelected]}
                  >
                    <Text
                      style={[
                        styles.toggleLabel,
                        selected && styles.toggleLabelSelected,
                      ]}
                    >
                      {value} min
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <Text style={styles.fieldLabel}>Players</Text>
            <View style={styles.groupRow}>
              {GROUP_SIZE_OPTIONS.map((size) => {
                const selected = groupSize === size
                return (
                  <Pressable
                    key={size}
                    onPress={() => setGroupSize(size)}
                    style={[styles.groupChip, selected && styles.groupChipSelected]}
                  >
                    <Text
                      style={[
                        styles.groupChipLabel,
                        selected && styles.groupChipLabelSelected,
                      ]}
                    >
                      {size}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {isLoading ? (
              <ActivityIndicator color={PlayTTColors.primary} />
            ) : (
              slots.map((slot) => {
                const past = isSlotStartInPast(slot.startsAt, nowMs)
                const disabled = past || !slot.isAvailable
                const selected = selectedSlot?.startsAt === slot.startsAt
                return (
                  <Pressable
                    key={slot.startsAt}
                    disabled={disabled}
                    onPress={() => setSelectedSlot(slot)}
                    style={[
                      styles.slotRow,
                      selected && styles.slotRowSelected,
                      disabled && styles.slotRowDisabled,
                    ]}
                  >
                    <View>
                      <Text style={styles.slotTime}>
                        {formatTimeRange(slot.startsAt, slot.endsAt)}
                      </Text>
                      <Text style={styles.slotMeta}>{slotSubtitle(slot, nowMs)}</Text>
                    </View>
                    <Text style={styles.slotPrice}>
                      {formatKes(slot.price.totalAmount, slot.price.currency)}
                    </Text>
                  </Pressable>
                )
              })
            )}

            <View style={styles.actionRow}>
              <View style={styles.actionButton}>
                <Button
                  label="Back"
                  variant="outline"
                  surface="product"
                  onPress={() => setStep("location")}
                />
              </View>
              <View style={styles.actionButton}>
                <Button
                  label="Continue"
                  surface="product"
                  onPress={() => setStep("checkout")}
                  disabled={!selectedSlot}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === "checkout" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{selectedLocation?.name}</Text>
            {selectedSlot ? (
              <Text style={styles.checkoutTime}>
                {formatTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)}
              </Text>
            ) : null}
            {quote ? (
              <Text style={styles.tier}>
                {formatPricingTierLabel(quote.pricingRuleSnapshot) ?? "Standard rate"}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Players: {groupSize}</Text>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything we should know?"
              placeholderTextColor={PlayTTColors.productMuted}
              style={styles.notesInput}
              multiline
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryAmount}>
                {quote
                  ? formatKes(quote.totalAmount, quote.currency)
                  : selectedSlot
                    ? formatKes(
                        selectedSlot.price.totalAmount,
                        selectedSlot.price.currency,
                      )
                    : "—"}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.actionButton}>
                <Button
                  label="Back"
                  variant="outline"
                  surface="product"
                  onPress={() => setStep("timing")}
                />
              </View>
              <View style={styles.actionButton}>
                <Button
                  label="Reserve booking"
                  surface="product"
                  onPress={handleConfirm}
                  loading={isLoading}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === "confirmed" && confirmation ? (
          <View style={styles.section}>
            <Text style={styles.confirmedTitle}>You're reserved</Text>
            <Text style={styles.confirmedBody}>
              {formatBookingStatus(confirmation.status, confirmation.paymentStatus)}
            </Text>
            {selectedSlot && selectedLocation ? (
              <>
                <Text style={styles.checkoutTime}>
                  {selectedLocation.name}
                </Text>
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
              onPress={() => router.replace("/(app)/(tabs)/bookings")}
            />
            <Button
              label="Book another session"
              variant="outline"
              surface="product"
              onPress={() => {
                setStep("location")
                setConfirmation(null)
                setSelectedSlot(null)
                setQuote(null)
                setNotes("")
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.productBackground,
  },
  scroll: {
    padding: PlayTTSpacing.lg,
    gap: PlayTTSpacing.md,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PlayTTColors.productBackground,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: PlayTTSpacing.xl,
    backgroundColor: PlayTTColors.productBackground,
  },
  emptyTitle: {
    ...PlayTTTypography.title,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  emptyBody: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
    textAlign: "center",
  },
  stepLabel: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  section: {
    gap: PlayTTSpacing.md,
  },
  sectionTitle: {
    ...PlayTTTypography.title,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  card: {
    backgroundColor: PlayTTColors.productCard,
    borderRadius: PlayTTRadius.lg,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
  },
  cardSelected: {
    borderColor: PlayTTColors.primary,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.primary,
  },
  dateRow: {
    flexDirection: "row",
    gap: PlayTTSpacing.xs,
  },
  dateChip: {
    minWidth: 56,
    alignItems: "center",
    paddingVertical: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.sm,
    borderRadius: PlayTTRadius.md,
    backgroundColor: PlayTTColors.productCard,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
  },
  dateChipSelected: {
    backgroundColor: PlayTTColors.primary,
    borderColor: PlayTTColors.primary,
  },
  dateChipDay: {
    fontSize: 11,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.productMuted,
  },
  dateChipDate: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  dateChipTextSelected: {
    color: PlayTTColors.primaryForeground,
  },
  toggleRow: {
    flexDirection: "row",
    gap: PlayTTSpacing.sm,
  },
  toggle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: PlayTTSpacing.sm,
    borderRadius: PlayTTRadius.md,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    backgroundColor: PlayTTColors.productCard,
  },
  toggleSelected: {
    backgroundColor: PlayTTColors.primary,
    borderColor: PlayTTColors.primary,
  },
  toggleLabel: {
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  toggleLabelSelected: {
    color: PlayTTColors.primaryForeground,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  groupRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PlayTTSpacing.xs,
  },
  groupChip: {
    minWidth: 40,
    alignItems: "center",
    paddingVertical: PlayTTSpacing.xs,
    paddingHorizontal: PlayTTSpacing.sm,
    borderRadius: PlayTTRadius.pill,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    backgroundColor: PlayTTColors.productCard,
  },
  groupChipSelected: {
    backgroundColor: PlayTTColors.primary,
    borderColor: PlayTTColors.primary,
  },
  groupChipLabel: {
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.productForeground,
  },
  groupChipLabelSelected: {
    color: PlayTTColors.primaryForeground,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: PlayTTSpacing.md,
    borderRadius: PlayTTRadius.md,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    backgroundColor: PlayTTColors.productCard,
  },
  slotRowSelected: {
    borderColor: PlayTTColors.primary,
  },
  slotRowDisabled: {
    opacity: 0.45,
  },
  slotTime: {
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  slotMeta: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
  slotPrice: {
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  actionRow: {
    flexDirection: "row",
    gap: PlayTTSpacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  checkoutTime: {
    fontSize: 22,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  tier: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.primary,
  },
  notesInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
    borderRadius: PlayTTRadius.md,
    padding: PlayTTSpacing.md,
    backgroundColor: PlayTTColors.productInput,
    color: PlayTTColors.productForeground,
    fontFamily: PlayTTFontFamilies.regular,
    textAlignVertical: "top",
  },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: PlayTTSpacing.md,
    borderRadius: PlayTTRadius.lg,
    backgroundColor: PlayTTColors.productCard,
    borderWidth: 1,
    borderColor: PlayTTColors.productBorder,
  },
  summaryLabel: {
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.productMuted,
  },
  summaryAmount: {
    fontSize: 20,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  confirmedTitle: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.productForeground,
  },
  confirmedBody: {
    ...PlayTTTypography.body,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.productMuted,
  },
  confirmedMeta: {
    fontSize: 15,
    fontFamily: PlayTTFontFamilies.medium,
    color: PlayTTColors.productForeground,
  },
})
