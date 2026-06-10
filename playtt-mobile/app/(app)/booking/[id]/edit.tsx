import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingEditForm } from "@/components/booking/booking-edit-form"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { BookingDetailSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { useProductTheme } from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"

export default function BookingEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: PlayTTSpacing.lg,
          paddingTop: PlayTTSpacing.sm,
        },
        back: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primary,
        },
        headerTitle: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        spacer: {
          width: 40,
        },
        body: {
          flex: 1,
          paddingHorizontal: PlayTTSpacing.lg,
        },
        blocked: {
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
      }),
    [theme.foreground, theme.muted],
  )

  const [booking, setBooking] = useState<UserBookingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      return
    }

    let mounted = true

    async function load() {
      setIsLoading(true)

      try {
        const data = await fetchBookingById(id)
        if (mounted) {
          setBooking(data)
        }
      } catch (error) {
        toast.apiError(error, "Could not load booking.")
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [id])

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit booking</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        {isLoading ? (
          <BookingDetailSkeleton surface="product" />
        ) : !booking ? (
          <Text style={styles.blocked}>Booking not found.</Text>
        ) : !booking.editable ? (
          <Text style={styles.blocked}>
            {booking.editBlockedReason ?? "This booking cannot be edited."}
          </Text>
        ) : (
          <BookingEditForm
            booking={booking}
            onUpdated={(updated) => {
              setBooking(updated)
              router.back()
            }}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
