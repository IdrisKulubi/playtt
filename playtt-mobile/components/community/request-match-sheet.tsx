import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { SegmentControl } from "@/components/ui/segment-control"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  COMMUNITY_SKILL_LEVELS,
  COMMUNITY_TIME_SLOTS,
  type CommunityPlayer,
} from "@/lib/mock/mock-community"
import { PRIMARY_VENUE } from "@/lib/venue-assets"
import { toast } from "@/lib/toast"

type RequestMatchSheetProps = {
  visible: boolean
  player?: CommunityPlayer | null
  onClose: () => void
  onSubmitted?: () => void
}

export function RequestMatchSheet({
  visible,
  player = null,
  onClose,
  onSubmitted,
}: RequestMatchSheetProps) {
  const theme = useProductTheme()
  const [skillLevel, setSkillLevel] = useState<string>(COMMUNITY_SKILL_LEVELS[1])
  const [preferredTime, setPreferredTime] = useState<string>(
    COMMUNITY_TIME_SLOTS[1],
  )
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!visible) {
      return
    }

    setSubmitted(false)
    setSkillLevel(player?.skillLevel ?? COMMUNITY_SKILL_LEVELS[1])
    setPreferredTime(player?.preferredTime ?? COMMUNITY_TIME_SLOTS[1])
  }, [player, visible])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.lg,
        },
        intro: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        field: {
          gap: PlayTTSpacing.sm,
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        venue: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        success: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.foreground,
          lineHeight: 22,
        },
      }),
    [theme],
  )

  function handleSubmit() {
    setSubmitted(true)
    onSubmitted?.()
    toast.success(
      player
        ? `Request sent to ${player.name}.`
        : "Your play request is live for nearby players.",
    )
  }

  const title = player ? `Play with ${player.name}` : "Request a match"

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} scrollable>
      <View style={styles.root}>
        {submitted ? (
          <Text style={styles.success}>
            Your request is in the preview queue. We will notify you when
            matchmaking goes live.
          </Text>
        ) : (
          <>
            <Text style={styles.intro}>
              {player
                ? player.bio
                : "Share when you want to play and your skill level. Other players at your venue can respond."}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Skill level</Text>
              <SegmentControl
                value={skillLevel}
                options={COMMUNITY_SKILL_LEVELS.map((level) => ({
                  value: level,
                  label: level,
                }))}
                onChange={setSkillLevel}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Preferred time</Text>
              <SegmentControl
                value={preferredTime}
                options={COMMUNITY_TIME_SLOTS.map((slot) => ({
                  value: slot,
                  label: slot,
                }))}
                onChange={setPreferredTime}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Venue</Text>
              <Text style={styles.venue}>{PRIMARY_VENUE.name}</Text>
            </View>

            <Button
              label={player ? "Send request" : "Post request"}
              surface="product"
              productTheme={theme}
              onPress={handleSubmit}
            />
          </>
        )}
      </View>
    </BottomSheet>
  )
}
