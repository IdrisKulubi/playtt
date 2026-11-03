import * as ImagePicker from "expo-image-picker"
import { Camera } from "phosphor-react-native/src/icons/Camera"
import { Trash } from "phosphor-react-native/src/icons/Trash"
import { useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native"

import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { typeStyle } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"
import { updateProfileSummary } from "@/hooks/use-profile-summary"
import { toast } from "@/lib/toast"
import { removeAvatar, uploadAvatar, type AvatarContentType } from "@/lib/user-api"

const ALLOWED_TYPES: AvatarContentType[] = ["image/jpeg", "image/png", "image/webp"]

type CardPhotoPickerProps = {
  hasPhoto: boolean
  onChange: (image: string | null) => void
}

/** Pick a photo from the library and upload it as the card / profile picture (stored in R2). */
export function CardPhotoPicker({ hasPhoto, onChange }: CardPhotoPickerProps) {
  const { colors } = useAppTheme()
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      // Once refused, only the phone's Settings can change it, so take people there.
      Alert.alert(
        "Photo access is off",
        "To add a card photo, allow PlayTT to use your photos in Settings.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ],
      )
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
      const image = await uploadAvatar(asset.uri, contentType)
      onChange(image)
      updateProfileSummary({ image })
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
      updateProfileSummary({ image: null })
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
          { borderColor: colors.separator, backgroundColor: colors.surface },
          pressed && styles.pressed,
          busy !== null && busy !== "upload" && styles.dimmed,
        ]}
      >
        {busy === "upload" ? (
          <ActivityIndicator color={colors.label} />
        ) : (
          <>
            <Camera size={20} color={colors.accentText} weight="fill" />
            <Text style={[styles.pillLabel, { color: colors.label }]}>{label}</Text>
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
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <Trash size={22} color={colors.destructive} weight="bold" />
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
    ...typeStyle("headline"),
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
