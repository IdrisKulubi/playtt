import * as ImagePicker from "expo-image-picker"
import { Camera } from "phosphor-react-native/src/icons/Camera"
import { Trash } from "phosphor-react-native/src/icons/Trash"
import { useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"
import { removeAvatar, uploadAvatar, type AvatarContentType } from "@/lib/user-api"

const ALLOWED_TYPES: AvatarContentType[] = ["image/jpeg", "image/png", "image/webp"]

type CardPhotoPickerProps = {
  hasPhoto: boolean
  onChange: (image: string | null) => void
}

/** Pick a photo from the library and upload it as the card / profile picture (stored in R2). */
export function CardPhotoPicker({ hasPhoto, onChange }: CardPhotoPickerProps) {
  const theme = useProductTheme()
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast.error("Allow photo access in Settings to add a card photo.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      // Below 1 makes iOS export JPEG instead of HEIC, and keeps uploads small.
      quality: 0.8,
    })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return

    const contentType = (asset.mimeType ?? "image/jpeg") as AvatarContentType
    if (!ALLOWED_TYPES.includes(contentType)) {
      toast.error("Use a JPEG, PNG or WebP photo.")
      return
    }

    setBusy("upload")
    try {
      onChange(await uploadAvatar(asset.uri, contentType))
      toast.success("Card photo updated.")
    } catch (error) {
      toast.apiError(error, "Could not upload your photo.")
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy("remove")
    try {
      await removeAvatar()
      onChange(null)
    } catch (error) {
      toast.apiError(error, "Could not remove your photo.")
    } finally {
      setBusy(null)
    }
  }

  const label = hasPhoto ? "Change photo" : "Add photo"

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: busy === "upload", disabled: busy !== null }}
        disabled={busy !== null}
        onPress={pick}
        style={({ pressed }) => [
          styles.pill,
          { borderColor: theme.border, backgroundColor: theme.card },
          pressed && styles.pressed,
          busy !== null && busy !== "upload" && styles.dimmed,
        ]}
      >
        {busy === "upload" ? (
          <ActivityIndicator color={theme.foreground} />
        ) : (
          <>
            <Camera size={20} color={PlayTTColors.primary} weight="fill" />
            <Text style={[styles.pillLabel, { color: theme.foreground }]}>{label}</Text>
          </>
        )}
      </Pressable>
      {hasPhoto ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
          accessibilityState={{ busy: busy === "remove", disabled: busy !== null }}
          disabled={busy !== null}
          onPress={remove}
          hitSlop={4}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
            busy !== null && busy !== "remove" && styles.dimmed,
          ]}
        >
          {busy === "remove" ? (
            <ActivityIndicator color={PlayTTColors.destructive} />
          ) : (
            <Trash size={22} color={PlayTTColors.destructive} weight="bold" />
          )}
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
  },
  pill: {
    flex: 1,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PlayTTSpacing.xs,
  },
  pillLabel: {
    fontFamily: PlayTTFontFamilies.semiBold,
    fontSize: 16,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.35)",
    backgroundColor: "rgba(255, 59, 48, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  dimmed: {
    opacity: 0.5,
  },
})
