import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BookingDetailContent } from "@/components/booking/booking-detail-content"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { BookingDetailSkeleton } from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"

export default function BookingDetailScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
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
        loading: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        missing: {
          color: theme.muted,
          fontFamily: PlayTTFontFamilies.regular,
        },
        scroll: {
          padding: PlayTTSpacing.xl,
        },
      }),
    [theme.foreground, theme.muted],
  )

  const { id } = useLocalSearchParams<{ id?: string }>()
  const bookingId = typeof id === "string" ? id : ""
  const [booking, setBooking] = useState<UserBookingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!bookingId) {
        setIsLoading(false)
        return
      }

      try {
        const data = await fetchBookingById(bookingId)
        if (mounted) setBooking(data)
      } catch (error) {
        toast.apiError(error, "Could not load booking details.")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [bookingId])

  return (
    <SafeAreaView style={screenStyles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Booking</Text>
        <View style={styles.spacer} />
      </View>

      {isLoading ? (
        <BookingDetailSkeleton surface={skeletonSurface} />
      ) : !booking ? (
        <View style={styles.loading}>
          <Text style={styles.missing}>Booking not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <BookingDetailContent booking={booking} surface={skeletonSurface} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
