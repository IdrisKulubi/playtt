import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CommunityPlayRequest } from "@/lib/mock/mock-community"

type OpenRequestsSectionProps = {
  requests: CommunityPlayRequest[]
}

function statusLabel(status: CommunityPlayRequest["status"]) {
  return status === "pending" ? "Pending" : "Open"
}

export function OpenRequestsSection({ requests }: OpenRequestsSectionProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          gap: PlayTTSpacing.xs,
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: PlayTTSpacing.xs,
        },
        row: {
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          gap: 4,
        },
        rowLast: {
          borderBottomWidth: 0,
        },
        topLine: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        name: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
          flex: 1,
        },
        badge: {
          fontSize: 11,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        meta: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Open requests</Text>
      {requests.map((request, index) => (
        <View
          key={request.id}
          style={[styles.row, index === requests.length - 1 && styles.rowLast]}
        >
          <View style={styles.topLine}>
            <Text style={styles.name}>{request.playerName}</Text>
            <Text style={styles.badge}>{statusLabel(request.status)}</Text>
          </View>
          <Text style={styles.meta}>
            {request.skillLevel} · {request.preferredTime}
          </Text>
          <Text style={styles.meta}>{request.venue}</Text>
        </View>
      ))}
    </View>
  )
}
